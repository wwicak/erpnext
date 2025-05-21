# Copyright (c) 2024, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import now_datetime, get_datetime, flt

# ERPNext Imports
from erpnext.accounts.doctype.pos_invoice.pos_invoice import POSInvoice
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice # Added for sync
from erpnext.accounts.doctype.pos_profile.pos_profile import POSProfile
from erpnext.stock.doctype.item.item import Item
from erpnext.stock.doctype.price_list.price_list import PriceList
from erpnext.stock.doctype.warehouse.warehouse import Warehouse
from erpnext.stock.utils import get_bin_qty # Used in _get_stock_levels_snapshot
from erpnext.accounts.party import get_party_details # Might be useful for customer details later
from erpnext.accounts.doctype.payment_mode.payment_mode import PaymentMode
from erpnext.accounts.doctype.sales_taxes_and_charges_template.sales_taxes_and_charges_template import SalesTaxesandChargesTemplate
from erpnext.accounts.doctype.accounts_settings.accounts_settings import AccountsSettings
from erpnext.controllers.selling_controller import SellingController # For some validation/calculation methods if needed

@frappe.whitelist()
def get_initial_pos_data(pos_profile_name, company):
    """
    Returns essential data for the Tauri app to start operating offline.
    """
    if not frappe.db.exists("POS Profile", pos_profile_name):
        frappe.throw(_("POS Profile {0} not found").format(pos_profile_name))

    pos_profile = frappe.get_doc("POS Profile", pos_profile_name)

    if pos_profile.company != company:
        frappe.throw(_("POS Profile {0} does not belong to company {1}").format(pos_profile_name, company))

    # 1. POS Profile Settings
    pos_profile_data = pos_profile.as_dict()
    # Add specific fields like income/expense accounts if not directly in as_dict()
    # These are often part of the company or default settings but good to have explicit if POS profile overrides
    pos_profile_data["income_account"] = pos_profile.get("income_account")
    pos_profile_data["expense_account"] = pos_profile.get("expense_account")
    # Ensure all child table data from pos_profile (like payments, item_groups, customer_groups) is included
    # as_dict() usually includes child tables, but good to be aware.

    # 2. Items & Item Prices
    items_data, item_prices_data = _get_items_and_prices_for_pos(pos_profile, company)

    # 3. Warehouses
    warehouses_data = _get_warehouses_for_pos(pos_profile, company)

    # 4. Stock Levels (Snapshot)
    stock_levels_data = _get_stock_levels_snapshot(items_data, warehouses_data)

    # 5. Customers
    customers_data = _get_customers_for_pos(pos_profile, company)

    # 6. Payment Modes
    payment_modes_data = []
    if pos_profile.payments:
        for p_mode in pos_profile.payments:
            payment_mode_doc = frappe.get_doc("Payment Mode", p_mode.payment_mode)
            payment_modes_data.append(payment_mode_doc.as_dict())
    
    # 7. Tax Templates
    # Fetch sales tax templates applicable. This might need refinement based on specific needs.
    tax_templates_data = frappe.get_all("Sales Taxes and Charges Template",
                                        filters={"is_active": 1, "company": company}, # TODO: check if is_active is a field
                                        fields=["name", "is_default", "title", "company", "account_head", "amount", "type"], ignore_permissions=True) 
                                        # Also need to fetch child table 'taxes' for full details if needed by POS
                                        # For now, keeping it to header level for brevity.

    # 8. Company Settings
    company_doc = frappe.get_doc("Company", company)
    company_settings = {
        "name": company_doc.name,
        "default_currency": company_doc.default_currency,
        "country": company_doc.country,
        "company_address": frappe.db.get_value("Address", company_doc.company_address, "*") if company_doc.company_address else None, # Added
        # Add other relevant company settings
        "default_cash_account": company_doc.default_cash_account,
        "default_receivable_account": company_doc.default_receivable_account,
        "default_income_account": company_doc.default_income_account, # Often overridden by POS Profile or Item Group
        "default_expense_account": company_doc.default_expense_account,
        "default_cost_center": company_doc.cost_center, # Often overridden by POS Profile
        "credit_controller": company_doc.credit_controller,
    }
    accounts_settings = frappe.get_cached_doc("Accounts Settings", {"company": company})
    company_settings["use_sales_invoice_in_pos"] = accounts_settings.use_sales_invoice_in_pos
    company_settings["allow_discount_accounting"] = accounts_settings.allow_discount_accounting
    company_settings["pos_show_stock_availability"] = accounts_settings.pos_show_stock_availability
    stock_settings = frappe.get_cached_doc("Stock Settings") # Fetches the Stock Settings singleton
    company_settings["auto_set_batch_nos"] = stock_settings.auto_set_batch_nos
    company_settings["auto_set_serial_nos"] = stock_settings.auto_set_serial_nos
    company_settings["allow_negative_stock"] = stock_settings.allow_negative_stock # Added for frontend reference


    return {
        "pos_profile_settings": pos_profile_data,
        "items": items_data,
        "item_prices": item_prices_data,
        "warehouses": warehouses_data,
        "stock_levels": stock_levels_data,
        "customers": customers_data,
        "payment_modes": payment_modes_data,
        "tax_templates": tax_templates_data,
        "company_settings": company_settings,
    }

@frappe.whitelist()
def sync_offline_transactions(transactions_list, pos_profile_name, company):
    """
    Syncs a list of offline transactions (POS Invoices) to ERPNext.
    """
    if isinstance(transactions_list, str):
        transactions_list = frappe.parse_json(transactions_list)

    if not frappe.db.exists("POS Profile", pos_profile_name):
        frappe.throw(_("POS Profile {0} not found").format(pos_profile_name))
    
    pos_profile = frappe.get_doc("POS Profile", pos_profile_name)
    if pos_profile.company != company:
        frappe.throw(_("POS Profile {0} does not belong to company {1}").format(pos_profile_name, company))

    results = []
    accounts_settings = frappe.get_cached_doc("Accounts Settings", {"company": company})
    use_sales_invoice = accounts_settings.use_sales_invoice_in_pos
    erpnext_allow_negative_stock = frappe.db.get_single_value('Stock Settings', 'allow_negative_stock')

    # Fetch company settings once for default cost center / income account
    company_doc_for_defaults = frappe.get_cached_doc("Company", company)


    for tx_data in transactions_list:
        current_invoice_doc_name_for_rollback = None # To keep track for rollback if insert happens but submit fails
        original_offline_tx_name = tx_data.get("name") # Assuming incoming data has a temporary name/ID

        try:
            # Basic validation: Ensure essential fields are present
            if not tx_data.get("customer") or not tx_data.get("items"):
                results.append({
                    "name": original_offline_tx_name, 
                    "success": False,
                    "error": "Missing customer or items in transaction data."
                })
                continue

            # Determine doctype: POS Invoice or Sales Invoice
            doctype = "Sales Invoice" if use_sales_invoice else "POS Invoice"
            
            invoice_doc = frappe.new_doc(doctype)
            
            # Set basic fields - map from tx_data to invoice_doc
            invoice_doc.is_pos = 1
            invoice_doc.pos_profile = pos_profile_name
            invoice_doc.company = company
            invoice_doc.customer = tx_data.get("customer")
            
            # Dates and Times
            invoice_doc.posting_date = tx_data.get("posting_date") or frappe.utils.today()
            invoice_doc.posting_time = tx_data.get("posting_time") or frappe.utils.nowtime()
            if doctype == "Sales Invoice":
                invoice_doc.due_date = tx_data.get("due_date") or invoice_doc.posting_date

            # Currency and Price List
            invoice_doc.currency = tx_data.get("currency") or pos_profile.currency
            invoice_doc.conversion_rate = tx_data.get("conversion_rate") or 1.0
            invoice_doc.selling_price_list = tx_data.get("selling_price_list") or pos_profile.selling_price_list
            if invoice_doc.selling_price_list:
                 price_list_currency = frappe.db.get_value("Price List", invoice_doc.selling_price_list, "currency")
                 invoice_doc.price_list_currency = price_list_currency
                 invoice_doc.plc_conversion_rate = tx_data.get("plc_conversion_rate") or 1.0 # POS should provide if conversion needed


            invoice_doc.ignore_pricing_rule = tx_data.get("ignore_pricing_rule", 0)
            invoice_doc.set_warehouse = tx_data.get("set_warehouse") or pos_profile.warehouse 
            
            # Loyalty, coupon codes etc.
            invoice_doc.loyalty_program = tx_data.get("loyalty_program")
            invoice_doc.loyalty_points = tx_data.get("loyalty_points")
            invoice_doc.coupon_code = tx_data.get("coupon_code")
            invoice_doc.apply_discount_on = tx_data.get("apply_discount_on", pos_profile.discount_on or "Grand Total") 
            invoice_doc.additional_discount_percentage = tx_data.get("additional_discount_percentage", 0)
            invoice_doc.additional_discount_amount = tx_data.get("additional_discount_amount", 0)


            # Add items
            for item_data in tx_data.get("items", []):
                child_item = invoice_doc.append("items", {})
                child_item.item_code = item_data.get("item_code")
                child_item.qty = item_data.get("qty")
                child_item.rate = item_data.get("rate")
                child_item.amount = flt(child_item.qty) * flt(child_item.rate) 
                child_item.warehouse = item_data.get("warehouse") or invoice_doc.set_warehouse
                child_item.serial_no = item_data.get("serial_no")
                child_item.batch_no = item_data.get("batch_no")
                child_item.uom = item_data.get("uom") or frappe.db.get_value("Item", child_item.item_code, "stock_uom")
                child_item.conversion_factor = item_data.get("conversion_factor") or 1.0
                child_item.discount_percentage = item_data.get("discount_percentage", 0)
                child_item.discount_amount = item_data.get("discount_amount", 0)
                child_item.item_tax_template = item_data.get("item_tax_template")
                
                item_details = frappe.get_cached_doc("Item", child_item.item_code)
                child_item.cost_center = item_data.get("cost_center") or item_details.cost_center or pos_profile.cost_center or company_doc_for_defaults.cost_center
                
                child_item.income_account = item_data.get("income_account") or \
                                           item_details.income_account or \
                                           frappe.db.get_value("Item Group", item_details.item_group, "income_account") or \
                                           pos_profile.income_account or \
                                           company_doc_for_defaults.default_income_account

            # Add payments
            if tx_data.get("payments"):
                for payment_data in tx_data.get("payments", []):
                    child_payment = invoice_doc.append("payments", {})
                    child_payment.mode_of_payment = payment_data.get("mode_of_payment")
                    child_payment.amount = payment_data.get("amount")
                    
                    account_found = False
                    # Priority 1: Account from POS Profile's mode of payment config
                    if pos_profile.payments:
                        for pp_mop in pos_profile.payments:
                            if pp_mop.payment_mode == child_payment.mode_of_payment and pp_mop.default_account:
                                child_payment.account = pp_mop.default_account
                                account_found = True; break
                    # Priority 2: Account from Payment Mode doctype's config for the company
                    if not account_found:
                        mop_accounts = frappe.get_all("Payment Mode Account", filters={"parent": child_payment.mode_of_payment, "company": company}, fields=["default_account"])
                        if mop_accounts:
                            child_payment.account = mop_accounts[0].default_account
                            account_found = True
                    # Priority 3: Account directly from transaction data (if POS allows specifying it)
                    if not account_found and payment_data.get("account"):
                        child_payment.account = payment_data.get("account")
                        account_found = True

                    if not account_found:
                        frappe.throw(_("Payment account not found for Mode of Payment '{0}' in POS Profile '{1}' or Payment Mode settings for Company '{2}'. Please configure the default account.").format(child_payment.mode_of_payment, pos_profile_name, company))


            # Add taxes (if provided by POS, otherwise will be calculated)
            if tx_data.get("taxes_and_charges_template"):
                 invoice_doc.taxes_and_charges = tx_data.get("taxes_and_charges_template")
            if tx_data.get("taxes"): 
                 for tax_data in tx_data.get("taxes"):
                    invoice_doc.append("taxes", tax_data)
            
            invoice_doc.update_stock = 1 if any(frappe.db.get_value("Item", item.item_code, "is_stock_item") for item in invoice_doc.items) else 0
            invoice_doc.paid_amount = sum(p.amount for p in invoice_doc.payments) if invoice_doc.payments else 0
            invoice_doc.change_amount = tx_data.get("change_amount", 0) 
            invoice_doc.offline_pos_name = original_offline_tx_name # Store the offline POS local ID/name

            invoice_doc.set_missing_values() # Populates defaults like accounts based on company/POS profile

            # === Pre-Insert Validations ===
            # These mimic parts of the .validate() method of controllers
            if hasattr(invoice_doc, 'validate_selling_price_list'): invoice_doc.validate_selling_price_list()
            if hasattr(invoice_doc, 'validate_price_list_currency'): invoice_doc.validate_price_list_currency()
            
            if doctype == "POS Invoice":
                if hasattr(invoice_doc, 'validate_pos_fields'): invoice_doc.validate_pos_fields()
                if hasattr(invoice_doc, 'validate_write_off_account'): invoice_doc.validate_write_off_account()
            else: # Sales Invoice
                if hasattr(invoice_doc, 'validate_debit_to_acc'): invoice_doc.validate_debit_to_acc()
                # check_credit_limit is usually on submit, but can be called here if needed
                # if hasattr(invoice_doc, 'check_credit_limit'): invoice_doc.check_credit_limit() 
            
            if hasattr(invoice_doc, 'validate_items'): invoice_doc.validate_items() # Validates item properties, UOMs etc.
            if hasattr(invoice_doc, 'validate_item_wise_tax_detail'): invoice_doc.validate_item_wise_tax_detail()

            # Calculate taxes if not fully provided or for verification.
            # This will also set totals.
            if hasattr(invoice_doc, 'calculate_taxes_and_totals'): invoice_doc.calculate_taxes_and_totals()
            
            # Loyalty points validation after totals are calculated
            if invoice_doc.loyalty_program and hasattr(invoice_doc, 'validate_loyalty_points'):
                invoice_doc.validate_loyalty_points(invoice_doc.loyalty_points) # Method might need adjustment based on its original context

            # Status update for POS Invoice before insert
            if doctype == "POS Invoice":
                if hasattr(invoice_doc, 'set_status'): invoice_doc.set_status(update=True) 
                if hasattr(invoice_doc, 'set_advances'): invoice_doc.set_advances()

            # === Insert ===
            invoice_doc.flags.ignore_permissions = True # Use with caution, ensure user has implicit rights
            invoice_doc.insert() 
            current_invoice_doc_name_for_rollback = invoice_doc.name # Get the actual doc name after insert
            
            # === Submit ===
            # The submit() call will run all controller validations including stock checks, credit limits (for SI) etc.
            invoice_doc.submit()

            results.append({
                "name": original_offline_tx_name,
                "success": True,
                "doc_id": invoice_doc.name,
                "message": f"{doctype} {invoice_doc.name} created and submitted successfully."
            })

                "message": f"{doctype} {invoice_doc.name} created and submitted successfully."
            })

        except frappe.ValidationError as e:
            frappe.log_error(message=frappe.get_traceback(), title=f"POS Custom API: Validation Error for Offline TX '{original_offline_tx_name}'")
            if current_invoice_doc_name_for_rollback and frappe.db.exists(doctype, current_invoice_doc_name_for_rollback):
                 doc_to_delete = frappe.get_doc(doctype, current_invoice_doc_name_for_rollback)
                 if not doc_to_delete.docstatus.is_submitted(): # type: ignore
                     frappe.delete_doc(doctype, current_invoice_doc_name_for_rollback, ignore_permissions=True, force=True, ignore_on_trash=True)
            results.append({
                "name": original_offline_tx_name,
                "success": False,
                "error": str(e),
                "doc_id": None
            })
        except Exception as e:
            frappe.log_error(message=frappe.get_traceback(), title=f"POS Custom API: General Error for Offline TX '{original_offline_tx_name}'")
            if current_invoice_doc_name_for_rollback and frappe.db.exists(doctype, current_invoice_doc_name_for_rollback):
                doc_to_delete = frappe.get_doc(doctype, current_invoice_doc_name_for_rollback)
                if not doc_to_delete.docstatus.is_submitted(): # type: ignore
                    frappe.delete_doc(doctype, current_invoice_doc_name_for_rollback, ignore_permissions=True, force=True, ignore_on_trash=True)
            results.append({
                "name": original_offline_tx_name,
                "success": False,
                "error": _("An unexpected error occurred: {0}").format(str(e)),
                "doc_id": None
            })
            
    return results

@frappe.whitelist()
def get_updated_master_data(pos_profile_name, company, last_sync_timestamp):
    """
    Returns data that has been created or modified since last_sync_timestamp.
    """
    if not frappe.db.exists("POS Profile", pos_profile_name):
        frappe.throw(_("POS Profile {0} not found").format(pos_profile_name))

    pos_profile = frappe.get_doc("POS Profile", pos_profile_name)
    if pos_profile.company != company:
        frappe.throw(_("POS Profile {0} does not belong to company {1}").format(pos_profile_name, company))

    try:
        last_sync_dt = get_datetime(last_sync_timestamp)
    except Exception:
        frappe.throw(_("Invalid last_sync_timestamp format. Please use ISO format (YYYY-MM-DD HH:MM:SS)."))

    updated_data = {}

    # Define doctypes to check for updates
    doctypes_to_sync = {
        "Item": ["item_code", "item_name", "description", "stock_uom", "is_stock_item", "has_serial_no", "has_batch_no", "image", "item_group", "brand", "disabled", "weight_per_unit", "weight_uom", "barcodes.barcode", "barcodes.uom"],
        "Item Price": ["price_list", "item_code", "price_list_rate", "currency", "uom", "valid_from", "valid_upto", "item_name", "packing_unit"], # Added item_name, packing_unit for convenience
        "Customer": ["name", "customer_name", "customer_group", "default_price_list", "loyalty_program", "credit_limit", "disabled", "email_id", "mobile_no", "tax_id", "customer_primary_address"],
        "POS Profile": ["name", "company", "warehouse", "currency", "selling_price_list", "customer_groups", "item_groups", "payments", "hide_images", "allow_rate_change", "allow_discount_change", "update_stock", "income_account", "expense_account", "cost_center"], 
        "Warehouse": ["name", "warehouse_name", "is_group", "company", "disabled"],
        "UOM": ["name", "uom_name", "must_be_whole_number"],
        "Brand": ["name", "description", "disabled"],
        "Item Group": ["name", "item_group_name", "parent_item_group", "is_group", "disabled", "income_account", "expense_account", "cost_center"],
        "Customer Group": ["name", "parent_customer_group", "is_group", "disabled", "default_price_list"],
        "Sales Taxes and Charges Template": ["name", "title", "is_default", "company", "disabled"], # For full details, client might need to fetch doc by name if it sees an update
        "Payment Mode": ["name", "mode_of_payment", "type", "disabled"], # For full details (accounts), client might need to fetch doc by name
    }

    for doctype, fields_to_fetch in doctypes_to_sync.items():
        filters_dict = {
            "modified": (">", last_sync_dt),
        }
        meta = frappe.get_meta(doctype)
        if meta.has_field("company") and doctype not in ["Company"]: 
            filters_dict["company"] = company
        
        if doctype == "Item":
            if pos_profile.item_groups:
                item_group_list = [ig.item_group for ig in pos_profile.item_groups if ig.item_group]
                if item_group_list: filters_dict["item_group"] = ("in", item_group_list)
            filters_dict["is_sales_item"] = 1 # Only sales items
            filters_dict["has_variants"] = 0 # No templates
        
        if doctype == "Item Price":
            price_lists_to_consider = []
            if pos_profile.selling_price_list: price_lists_to_consider.append(pos_profile.selling_price_list)
            # Add price lists from customer groups linked to the POS profile
            if pos_profile.customer_groups:
                for cg_entry in pos_profile.customer_groups:
                    if cg_entry.customer_group:
                        cg_pl = frappe.db.get_value("Customer Group", cg_entry.customer_group, "default_price_list", cache=True)
                        if cg_pl and cg_pl not in price_lists_to_consider:
                            price_lists_to_consider.append(cg_pl)
            if not price_lists_to_consider: # If no price lists, skip item price sync for this profile
                continue
            filters_dict["price_list"] = ("in", list(set(price_lists_to_consider)))
            filters_dict["selling"] = 1
        
        if doctype == "POS Profile": filters_dict["name"] = pos_profile_name
        if doctype == "Customer":
             if pos_profile.customer_groups:
                cg_list = [cg.customer_group for cg in pos_profile.customer_groups if cg.customer_group]
                if cg_list: filters_dict["customer_group"] = ("in", cg_list)
             # How to handle default customer? If it's modified, it will be caught by name.
             # If it's outside groups, might need special handling if not simply by modified date.
             # For now, relying on modified date.

        # Use frappe.get_list for performance with many fields. get_all is fine for moderate cases.
        # Ensure "name" is always fetched for identification.
        final_fields_to_fetch = ["name"] + [f for f in fields_to_fetch if f != "name"]

        docs = frappe.get_list(doctype, filters=filters_dict, fields=final_fields_to_fetch, ignore_permissions=True)
        
        # For doctypes that have important child tables and are less numerous (like POS Profile),
        # fetch the full document to make it easier for the client.
        if doctype in ["POS Profile", "Sales Taxes and Charges Template", "Payment Mode"] and docs:
            full_docs_list = []
            for d in docs:
                try:
                    # .as_dict() is efficient here as we already have the name (d.name)
                    full_doc = frappe.get_doc(doctype, d.name).as_dict()
                    full_docs_list.append(full_doc)
                except frappe.DoesNotExistError:
                    frappe.log_error(f"Document {doctype} {d.name} not found during get_updated_master_data full fetch.")
            docs = full_docs_list

        if docs:
            updated_data[doctype] = docs
            
    # Include deleted documents
    deleted_doc_entries = frappe.get_all("Deleted Document",
        filters={
            "creation": (">", last_sync_dt), 
            "deleted_doctype": ("in", list(doctypes_to_sync.keys()))
        },
        fields=["deleted_doctype", "docname"], # 'docname' holds the name of the original deleted document
        ignore_permissions=True
    )
    if deleted_doc_entries:
        deleted_map = {}
        for entry in deleted_doc_entries:
            # Ensure company context for deleted docs if applicable
            # This is tricky as Deleted Document doesn't store company directly
            # Relying on the client to manage its own data store's company context
            deleted_map.setdefault(entry.deleted_doctype, []).append(entry.docname)
        if deleted_map: # only add if there are relevant deleted documents
             updated_data["DeletedDocuments"] = deleted_map


    return updated_data

# ---- Non-whitelisted helper functions below ----

def _get_items_and_prices_for_pos(pos_profile, company):
    """
    Helper to fetch items and their prices based on POS Profile.
    """
    """
    Helper to fetch items and their prices based on POS Profile.
    """
    items_conditions = {"disabled": 0, "is_sales_item": 1, "has_variants": 0} # No item templates
    if pos_profile.item_groups:
        item_group_list = [ig.item_group for ig in pos_profile.item_groups if ig.item_group] 
        if item_group_list: items_conditions["item_group"] = ("in", item_group_list)
    
    if frappe.get_meta("Item").has_field("company"): items_conditions["company"] = company
    
    items_fields = [
        "name as item_code", "item_name", "description", "stock_uom", "item_group", "brand",
        "is_stock_item", "has_serial_no", "has_batch_no", "image", "disabled", "weight_per_unit", "weight_uom",
        "income_account", # For reference on POS if needed for overrides
        "opening_stock", "valuation_rate", # For basic stock/value reference, not live qty
        "`tabItem Barcode`.barcode", "`tabItem Barcode`.uom as barcode_uom" # Fetch barcodes child table
    ]
    # Using frappe.get_list for potentially large item sets for performance
    items = frappe.get_list("Item", filters=items_conditions, fields=items_fields, ignore_permissions=True, distinct=True)

    item_codes = [item.item_code for item in items]
    uom_details_map = {}
    if item_codes:
        uom_conv_details = frappe.get_all("UOM Conversion Detail",
                                     filters={"parenttype": "Item", "parent": ("in", item_codes), "disabled":0},
                                     fields=["parent as item_code", "uom", "conversion_factor"], ignore_permissions=True)
        for ucd in uom_conv_details:
            uom_details_map.setdefault(ucd.item_code, []).append({"uom": ucd.uom, "conversion_factor": ucd.conversion_factor})

    for item in items:
        item.uoms = uom_details_map.get(item.item_code, [])
        if not any(u['uom'] == item.stock_uom for u in item.uoms) and item.stock_uom:
            item.uoms.append({"uom": item.stock_uom, "conversion_factor": 1.0})

    # Item Prices
    item_prices_data = []
    price_lists_to_fetch = []
    if pos_profile.selling_price_list: price_lists_to_fetch.append(pos_profile.selling_price_list)
    
    # Add price lists from customer groups linked to the POS profile
    if pos_profile.customer_groups:
        for cg_entry in pos_profile.customer_groups:
            if cg_entry.customer_group:
                cg_pl = frappe.db.get_value("Customer Group", cg_entry.customer_group, "default_price_list", cache=True)
                if cg_pl and cg_pl not in price_lists_to_fetch:
                    price_lists_to_fetch.append(cg_pl)
    
    if item_codes and price_lists_to_fetch:
        item_prices_data = frappe.get_list("Item Price",
                                          filters={
                                              "item_code": ("in", item_codes),
                                              "price_list": ("in", list(set(price_lists_to_fetch))), # Unique list
                                              "selling": 1, 
                                          },
                                          fields=["item_code", "price_list", "price_list_rate", "currency", "uom", "valid_from", "valid_upto", "item_name", "packing_unit"],
                                          ignore_permissions=True)
    return items, item_prices_data


def _get_warehouses_for_pos(pos_profile, company):
    """
    Helper to fetch relevant warehouses.
    """
    warehouse_list = []
    if pos_profile.warehouse: 
        warehouse_list.append(pos_profile.warehouse)
    
    if not warehouse_list: 
        company_default_warehouse = frappe.db.get_value("Company", company, "default_warehouse")
        if company_default_warehouse:
            warehouse_list.append(company_default_warehouse)
            frappe.log_message(f"POS Profile {pos_profile.name} has no warehouse. Using company default: {company_default_warehouse}", "POS Custom API")
        else: # No POS profile warehouse and no company default: critical misconfiguration
             frappe.throw(_("No warehouse specified in POS Profile '{0}' and no Company Default Warehouse found. Please configure warehouses.").format(pos_profile.name))


    warehouses_data = frappe.get_list("Warehouse",
                                     filters={"name": ("in", list(set(warehouse_list))), "is_group":0, "disabled":0, "company":company},
                                     fields=["name", "warehouse_name", "is_group", "company"], 
                                     ignore_permissions=True) 
    return warehouses_data


def _get_stock_levels_snapshot(items_data, warehouses_data):
    """
    Helper to get a snapshot of stock levels for given items and warehouses.
    """
    stock_levels = []
    # Filter for actual stock items only
    stock_item_codes = [item.item_code for item in items_data if item.is_stock_item]
    warehouse_names = [wh.name for wh in warehouses_data]

    if not stock_item_codes or not warehouse_names:
        return []

    for item_code in stock_item_codes:
        for wh_name in warehouse_names:
            try:
                actual_qty = get_bin_qty(item_code, wh_name) 
                stock_levels.append({
                    "item_code": item_code,
                    "warehouse": wh_name,
                    "actual_qty": actual_qty,
                    "timestamp": now_datetime()
                })
            except Exception as e:
                frappe.log_error(message=f"Error fetching stock for {item_code} in {wh_name}: {str(e)}", title="POS Custom API Stock Snapshot Error")
                stock_levels.append({
                    "item_code": item_code,
                    "warehouse": wh_name,
                    "actual_qty": 0, 
                    "timestamp": now_datetime(),
                    "error": "Error fetching stock" # Keep error message generic for POS
                })
    return stock_levels

def _get_customers_for_pos(pos_profile, company):
    """
    Helper to fetch customers.
    """
    customer_conditions = {"disabled": 0}
    if frappe.get_meta("Customer").has_field("company") and company:
         customer_conditions["company"] = company

    customer_list_from_groups = []
    if pos_profile.customer_groups:
        cg_list = [cg.customer_group for cg in pos_profile.customer_groups if cg.customer_group] 
        if cg_list:
            # Fetch customers belonging to these groups
            customers_in_groups = frappe.get_list("Customer", filters={"customer_group": ("in", cg_list), "disabled": 0, "company":company}, fields=["name"], ignore_permissions=True)
            customer_list_from_groups = [c.name for c in customers_in_groups]

    # Always include the default customer from POS Profile if set
    all_customer_names_to_fetch = set(customer_list_from_groups)
    if pos_profile.customer:
        all_customer_names_to_fetch.add(pos_profile.customer)
    
    if not all_customer_names_to_fetch:
        return [] # No specific customers identified, return empty list.

    customer_fields = ["name", "customer_name", "customer_group", "default_price_list", "loyalty_program", "credit_limit", "email_id", "mobile_no", "disabled", "tax_id", "customer_primary_address", "default_sales_partner", "default_commission_rate"]
    
    final_filters = {"name": ("in", list(all_customer_names_to_fetch)), "disabled": 0}
    if frappe.get_meta("Customer").has_field("company") and company: # Redundant if company already in customer_conditions but safe
        final_filters["company"] = company

    customers = frappe.get_list("Customer",
                               filters=final_filters,
                               fields=customer_fields,
                               ignore_permissions=True)
            
    return customers
