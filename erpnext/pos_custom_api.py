# Copyright (c) 2024, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import now_datetime, get_datetime, flt

# ERPNext Imports
from frappe.permissions import get_roles # For role check in pos_login
from erpnext.accounts.doctype.pos_invoice.pos_invoice import POSInvoice
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice 
from erpnext.accounts.doctype.pos_profile.pos_profile import POSProfile
from erpnext.stock.doctype.item.item import Item
from erpnext.stock.doctype.price_list.price_list import PriceList
from erpnext.stock.doctype.warehouse.warehouse import Warehouse
from erpnext.stock.utils import get_bin_qty 
from erpnext.accounts.party import get_party_details 
from erpnext.accounts.doctype.payment_mode.payment_mode import PaymentMode
from erpnext.accounts.doctype.sales_taxes_and_charges_template.sales_taxes_and_charges_template import SalesTaxesandChargesTemplate
from erpnext.accounts.doctype.accounts_settings.accounts_settings import AccountsSettings
from erpnext.controllers.selling_controller import SellingController 


# --- User Authentication and Session Logging ---
@frappe.whitelist(allow_guest=True) 
def pos_login(usr, pwd, pos_profile_name=None):
    """
    Authenticates a user for POS access, logs the session.
    Optionally associates the login with a POS Profile.
    Role check for "POS Attendant" can be uncommented if needed.
    """
    try:
        login_manager = frappe.LoginManager()
        login_manager.authenticate(user=usr, pwd=pwd)
        frappe.local.login_manager = login_manager 

        # Optional: Role check (Uncomment and adjust if a specific "POS Attendant" role is required)
        # required_pos_role = "POS Attendant" 
        # user_roles = get_roles(frappe.session.user)
        # if required_pos_role not in user_roles:
        #     frappe.throw(
        #         _("User {0} does not have the required role: {1}").format(usr, required_pos_role), 
        #         frappe.AuthenticationError,
        #         title=_("Role Missing")
        #     )
        
        log_pos_session_event(
            user=frappe.session.user,
            event_type="Login",
            pos_profile=pos_profile_name,
            ip_address=frappe.local.request_ip if hasattr(frappe.local, 'request_ip') else None,
            notes=f"User {usr} logged in successfully for POS Profile {pos_profile_name or 'N/A'}."
        )
        frappe.db.commit() # Commit the log entry immediately

        return {
            "message": "Authentication Success",
            "user_id": frappe.session.user,
            "full_name": frappe.utils.get_fullname(frappe.session.user),
            "session_csrf_token": frappe.session.data.csrf_token 
        }
    except frappe.AuthenticationError as e:
        frappe.local.response.http_status_code = 401
        return {"error": str(e), "error_title": _("Authentication Failed")}
    except Exception as e:
        frappe.log_error(message=frappe.get_traceback(), title="POS Login Error")
        frappe.local.response.http_status_code = 500
        return {"error": "An unexpected error occurred during login.", "error_title": _("Login Error")}

def log_pos_session_event(user, event_type, pos_profile=None, ip_address=None, notes=None):
    """Helper function to create POS Session Log entries."""
    try:
        if not frappe.db.exists("DocType", "POS Session Log"):
            frappe.log_message("POS Custom API", "DocType POS Session Log not found. Please create it for audit trail.", level=frappe.LOG_WARNING)
            return

        log_entry = frappe.new_doc("POS Session Log")
        log_entry.user = user
        log_entry.event_type = event_type
        log_entry.timestamp = now_datetime()
        if pos_profile:
            log_entry.pos_profile = pos_profile
        if ip_address:
            log_entry.ip_address = ip_address
        if notes:
            log_entry.notes = notes
        log_entry.flags.ignore_permissions = True 
        log_entry.save(ignore_permissions=True)
        # Let the calling function (pos_login) manage commit.
    except Exception as e:
        frappe.log_error(message=frappe.get_traceback(), title="Failed to create POS Session Log")


# --- Receipt Template ---
@frappe.whitelist()
def get_receipt_template_details(pos_profile_name=None, company=None):
    """
    Fetches POS Receipt Template details.
    Priority:
    1. Template directly linked to the given POS Profile.
    2. Default template for the company (if POS Profile not given or no template linked to it).
    3. Hardcoded system default if no specific or company default is found.
    """
    if not company and pos_profile_name:
        company = frappe.db.get_value("POS Profile", pos_profile_name, "company")
    
    if not company:
        # Attempt to get current user's company if no other company context
        # This part is tricky as API calls might not always have a logged-in user session in the same way UI does.
        # For robustness, it's better if company is explicitly passed or derived from a mandatory pos_profile_name.
        # Fallback to current session user's company as a last resort.
        if frappe.session.user != "Guest": # type: ignore
            company = frappe.get_cached_value("User", frappe.session.user, "company") # type: ignore
        
        if not company: # If still no company after checking session user
            frappe.throw(_("Company is required to fetch receipt template and could not be determined."), frappe.ValidationError)

    # Check if POS Receipt Template Doctype exists
    if not frappe.db.exists("DocType", "POS Receipt Template"):
        frappe.log_message("POS Custom API", "POS Receipt Template Doctype not found. Returning system default.", level=frappe.LOG_WARNING)
        return _get_system_default_receipt_template(company) # Pass company for placeholders

    template = None
    # 1. Try to get template specific to the POS Profile
    if pos_profile_name:
        template = frappe.db.get_value("POS Receipt Template", 
                                       {"pos_profile": pos_profile_name, "company": company, "disabled": 0}, 
                                       "*", as_dict=True)
    
    # 2. If not found, try to get company default template
    if not template:
        template = frappe.db.get_value("POS Receipt Template", 
                                       {"is_default": 1, "company": company, "disabled": 0}, 
                                       "*", as_dict=True)
    
    # 3. If still not found, return hardcoded system default
    if not template:
        frappe.log_message("POS Custom API", f"No specific or company default POS Receipt Template found for Company {company}. Returning system default.", level=frappe.LOG_INFO)
        return _get_system_default_receipt_template(company)
    
    # Ensure header_logo URL is correctly formed if it exists
    if template.get("header_logo") and not template.header_logo.startswith(("/files/", "http")):
        template.header_logo = "/files/" + template.header_logo.lstrip("/")

    return template

def _get_system_default_receipt_template(company_name=None):
    """Returns a hardcoded basic receipt template, populating company placeholders if company_name is provided."""
    company_doc = None
    company_address_str = ""
    company_phone_str = ""
    resolved_company_name = "Your Company" # Fallback placeholder name
    
    if company_name:
        try:
            company_doc = frappe.get_cached_doc("Company", company_name)
            resolved_company_name = company_doc.company_name or resolved_company_name
            if company_doc.company_address:
                # Fetch address details as a dict to avoid issues if Address doc is not available in some contexts
                addr_details = frappe.db.get_value("Address", company_doc.company_address, 
                                                   ["address_line1", "address_line2", "city", "state", "pincode"], 
                                                   as_dict=True)
                if addr_details:
                    company_address_str = ", ".join(filter(None, [
                        addr_details.get("address_line1"), 
                        addr_details.get("address_line2"), 
                        addr_details.get("city"), 
                        addr_details.get("state"), 
                        addr_details.get("pincode")
                    ]))
            company_phone_str = company_doc.phone_no or ""
        except frappe.DoesNotExistError:
            frappe.log_error(f"Company {company_name} not found for default receipt template placeholders.", "POS Receipt Template")
            # resolved_company_name remains "Your Company"

    header_text_template = """
<div style="text-align:center;">
    <h2>{company_name}</h2>
    <p>{company_address}</p>
    <p>Phone: {company_phone}</p>
</div>
"""
    
    return {
        "name": "_system_default_",
        "template_name": "System Default Receipt",
        "company": company_name, 
        "pos_profile": None,
        "is_default": 0,
        "receipt_width_mm": 78,
        "header_logo": None,
        "header_text": header_text_template.format(
            company_name=resolved_company_name,
            company_address=company_address_str,
            company_phone=company_phone_str
        ),
        "item_line_format": "{qty} x {item_name} - {rate} - {amount}",
        "subtotal_label": "Subtotal",
        "tax_label_format": "{description} ({tax_rate}%): {amount}",
        "grand_total_label": "GRAND TOTAL",
        "payment_mode_label_format": "{mode_of_payment}: {amount}",
        "change_due_label": "Change:",
        "footer_text": "<p style='text-align:center;'>Thank you for your business!</p>",
        "font_size_css": "10pt",
        "line_spacing_css": "1.2",
        "disable_erpnext_branding": 1
    }


# --- Main Data Endpoints ---
@frappe.whitelist()
def get_initial_pos_data(pos_profile_name, company):
    if not frappe.db.exists("POS Profile", pos_profile_name):
        frappe.throw(_("POS Profile {0} not found").format(pos_profile_name))

    pos_profile = frappe.get_doc("POS Profile", pos_profile_name)

    if pos_profile.company != company:
        frappe.throw(_("POS Profile {0} does not belong to company {1}").format(pos_profile_name, company))

    pos_profile_data = pos_profile.as_dict()
    pos_profile_data["income_account"] = pos_profile.get("income_account")
    pos_profile_data["expense_account"] = pos_profile.get("expense_account")

    items_data, item_prices_data = _get_items_and_prices_for_pos(pos_profile, company)
    warehouses_data = _get_warehouses_for_pos(pos_profile, company)
    stock_levels_data = _get_stock_levels_snapshot(items_data, warehouses_data)
    customers_data = _get_customers_for_pos(pos_profile, company) 

    payment_modes_data = []
    if pos_profile.payments:
        for p_mode in pos_profile.payments:
            try:
                payment_mode_doc = frappe.get_doc("Payment Mode", p_mode.payment_mode)
                payment_modes_data.append(payment_mode_doc.as_dict())
            except frappe.DoesNotExistError:
                frappe.log_error(f"Payment Mode {p_mode.payment_mode} not found for POS Profile {pos_profile_name}", "POS Initial Data")


    tax_templates_data = frappe.get_all("Sales Taxes and Charges Template",
                                        filters={"company": company, "disabled":0}, 
                                        fields=["name", "is_default", "title", "company", "account_head", "amount", "type"], ignore_permissions=True) 

    company_doc = frappe.get_doc("Company", company)
    company_address_details = None
    if company_doc.company_address:
        try:
            company_address_details = frappe.get_doc("Address", company_doc.company_address).as_dict()
        except frappe.DoesNotExistError:
            frappe.log_warning(f"Company Address {company_doc.company_address} not found for Company {company}", "POS Initial Data")

    company_settings = {
        "name": company_doc.name,
        "default_currency": company_doc.default_currency,
        "country": company_doc.country,
        "company_address": company_address_details, # This will be a dict or None
        "default_cash_account": company_doc.default_cash_account,
        "default_receivable_account": company_doc.default_receivable_account,
        "default_income_account": company_doc.default_income_account,
        "default_expense_account": company_doc.default_expense_account,
        "default_cost_center": company_doc.cost_center,
        "credit_controller": company_doc.credit_controller,
        "company_phone": company_doc.phone_no, 
    }
    
    accounts_settings = frappe.get_cached_doc("Accounts Settings", {"company": company})
    company_settings["use_sales_invoice_in_pos"] = accounts_settings.use_sales_invoice_in_pos
    company_settings["allow_discount_accounting"] = accounts_settings.allow_discount_accounting
    company_settings["pos_show_stock_availability"] = accounts_settings.pos_show_stock_availability
    
    stock_settings = frappe.get_cached_doc("Stock Settings")
    company_settings["auto_set_batch_nos"] = stock_settings.auto_set_batch_nos
    company_settings["auto_set_serial_nos"] = stock_settings.auto_set_serial_nos
    company_settings["allow_negative_stock"] = stock_settings.allow_negative_stock

    # Fetch receipt template data
    receipt_template_data = get_receipt_template_details(pos_profile_name, company)
    
    # If system default receipt template is used, and company_address was not fully resolved for it,
    # try to populate its placeholders using company_settings which now has address as dict.
    # This check ensures we only format if it's the actual default template from _get_system_default_receipt_template
    if receipt_template_data.get("name") == "_system_default_":
        header_text = receipt_template_data.get("header_text", "") # Get the template string
        company_address_str = ""
        if company_settings.get("company_address"): 
            addr = company_settings["company_address"] # This is now a dict
            company_address_str = ", ".join(filter(None, [
                addr.get("address_line1"), addr.get("address_line2"), addr.get("city"), 
                addr.get("state"), addr.get("pincode")
            ]))
        
        receipt_template_data["header_text"] = header_text.format(
            company_name=company_doc.company_name or "Your Company",
            company_address=company_address_str,
            company_phone=company_doc.phone_no or ""
        )

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
        "receipt_template_data": receipt_template_data 
    }

@frappe.whitelist()
def sync_offline_transactions(transactions_list, pos_profile_name, company, attendant_user_id=None):
    if isinstance(transactions_list, str):
        transactions_list = frappe.parse_json(transactions_list)

    if not frappe.db.exists("POS Profile", pos_profile_name):
        frappe.throw(_("POS Profile {0} not found").format(pos_profile_name))
    
    pos_profile_doc = frappe.get_doc("POS Profile", pos_profile_name)
    if pos_profile_doc.company != company:
        frappe.throw(_("POS Profile {0} does not belong to company {1}").format(pos_profile_name, company))

    results = []
    accounts_settings = frappe.get_cached_doc("Accounts Settings", {"company": company})
    use_sales_invoice = accounts_settings.use_sales_invoice_in_pos
    erpnext_allow_negative_stock = frappe.db.get_single_value('Stock Settings', 'allow_negative_stock')
    
    default_customer_from_profile = pos_profile_doc.customer
    default_customer_from_settings = frappe.db.get_single_value('Selling Settings', 'pos_walk_in_customer')
    final_default_customer = default_customer_from_profile or default_customer_from_settings
    if not final_default_customer:
        frappe.log_message("POS Custom API", 
                           f"No default customer found in POS Profile '{pos_profile_name}' or Selling Settings. Transactions without a customer might fail.",
                           level=frappe.LOG_WARNING)

    company_doc_for_defaults = frappe.get_cached_doc("Company", company)

    for tx_data in transactions_list:
        current_invoice_doc_name_for_rollback = None 
        original_offline_tx_name = tx_data.get("name") 

        try:
            current_tx_customer = tx_data.get("customer")
            if not current_tx_customer and final_default_customer:
                tx_data["customer"] = final_default_customer 
                frappe.log_message("POS Custom API", f"Transaction {original_offline_tx_name} used default customer {final_default_customer}", level=frappe.LOG_DEBUG)
            elif not current_tx_customer and not final_default_customer:
                 frappe.log_message("POS Custom API", f"Transaction {original_offline_tx_name} has no customer and no default was found.", level=frappe.LOG_WARNING)

            if not tx_data.get("customer") or not tx_data.get("items"):
                results.append({
                    "name": original_offline_tx_name, 
                    "success": False,
                    "error": "Missing customer (and no default could be applied) or items in transaction data."
                })
                continue

            doctype = "Sales Invoice" if use_sales_invoice else "POS Invoice"
            invoice_doc = frappe.new_doc(doctype)
            
            invoice_doc.is_pos = 1
            invoice_doc.pos_profile = pos_profile_name
            invoice_doc.company = company
            invoice_doc.customer = tx_data.get("customer")
            
            if attendant_user_id and invoice_doc.meta.has_field('custom_pos_attendant'):
                invoice_doc.custom_pos_attendant = attendant_user_id
            elif attendant_user_id and not invoice_doc.meta.has_field('custom_pos_attendant'):
                frappe.log_message("POS Custom API", f"Custom field 'custom_pos_attendant' not found on Doctype {doctype}. Cannot set POS Attendant.", level=frappe.LOG_WARNING)

            invoice_doc.posting_date = tx_data.get("posting_date") or frappe.utils.today()
            invoice_doc.posting_time = tx_data.get("posting_time") or frappe.utils.nowtime()
            if doctype == "Sales Invoice":
                invoice_doc.due_date = tx_data.get("due_date") or invoice_doc.posting_date

            invoice_doc.currency = tx_data.get("currency") or pos_profile_doc.currency
            invoice_doc.conversion_rate = tx_data.get("conversion_rate") or 1.0
            invoice_doc.selling_price_list = tx_data.get("selling_price_list") or pos_profile_doc.selling_price_list
            if invoice_doc.selling_price_list:
                 price_list_currency = frappe.db.get_value("Price List", invoice_doc.selling_price_list, "currency")
                 invoice_doc.price_list_currency = price_list_currency
                 invoice_doc.plc_conversion_rate = tx_data.get("plc_conversion_rate") or 1.0

            invoice_doc.ignore_pricing_rule = tx_data.get("ignore_pricing_rule", 0)
            invoice_doc.set_warehouse = tx_data.get("set_warehouse") or pos_profile_doc.warehouse 
            invoice_doc.loyalty_program = tx_data.get("loyalty_program")
            invoice_doc.loyalty_points = tx_data.get("loyalty_points")
            invoice_doc.coupon_code = tx_data.get("coupon_code")
            invoice_doc.apply_discount_on = tx_data.get("apply_discount_on", pos_profile_doc.discount_on or "Grand Total") 
            invoice_doc.additional_discount_percentage = tx_data.get("additional_discount_percentage", 0)
            invoice_doc.additional_discount_amount = tx_data.get("additional_discount_amount", 0)

            for item_data in tx_data.get("items", []):
                child_item = invoice_doc.append("items", {})
                # Map all relevant item fields from item_data to child_item
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
                child_item.cost_center = item_data.get("cost_center") or item_details.cost_center or pos_profile_doc.cost_center or company_doc_for_defaults.cost_center
                child_item.income_account = item_data.get("income_account") or \
                                           item_details.income_account or \
                                           frappe.db.get_value("Item Group", item_details.item_group, "income_account") or \
                                           pos_profile_doc.income_account or \
                                           company_doc_for_defaults.default_income_account

            if tx_data.get("payments"):
                for payment_data in tx_data.get("payments", []):
                    child_payment = invoice_doc.append("payments", {})
                    child_payment.mode_of_payment = payment_data.get("mode_of_payment")
                    child_payment.amount = payment_data.get("amount")
                    account_found = False
                    if pos_profile_doc.payments:
                        for pp_mop in pos_profile_doc.payments:
                            if pp_mop.payment_mode == child_payment.mode_of_payment and pp_mop.default_account:
                                child_payment.account = pp_mop.default_account
                                account_found = True; break
                    if not account_found:
                        mop_accounts = frappe.get_all("Payment Mode Account", filters={"parent": child_payment.mode_of_payment, "company": company}, fields=["default_account"])
                        if mop_accounts:
                            child_payment.account = mop_accounts[0].default_account
                            account_found = True
                    if not account_found and payment_data.get("account"):
                        child_payment.account = payment_data.get("account")
                        account_found = True
                    if not account_found:
                        frappe.throw(_("Payment account not found for Mode of Payment '{0}' in POS Profile '{1}' or Payment Mode settings for Company '{2}'. Please configure the default account.").format(child_payment.mode_of_payment, pos_profile_name, company))

            if tx_data.get("taxes_and_charges_template"):
                 invoice_doc.taxes_and_charges = tx_data.get("taxes_and_charges_template")
            if tx_data.get("taxes"): 
                 for tax_data in tx_data.get("taxes"):
                    invoice_doc.append("taxes", tax_data)
            
            invoice_doc.update_stock = 1 if any(frappe.db.get_value("Item", item.item_code, "is_stock_item") for item in invoice_doc.items) else 0
            invoice_doc.paid_amount = sum(p.amount for p in invoice_doc.payments) if invoice_doc.payments else 0
            invoice_doc.change_amount = tx_data.get("change_amount", 0) 
            invoice_doc.offline_pos_name = original_offline_tx_name 

            invoice_doc.set_missing_values() 
            
            # === Rigorous Stock Validation (Before Insert) ===
            if invoice_doc.update_stock: 
                for item_row in invoice_doc.items:
                    item_details_for_stock_check = frappe.get_cached_doc("Item", item_row.item_code)
                    if item_details_for_stock_check.is_stock_item:
                        actual_available_qty = get_bin_qty(item_row.item_code, item_row.warehouse)
                        qty_in_stock_uom = item_row.qty 
                        if item_row.uom != item_details_for_stock_check.stock_uom:
                            if not item_row.conversion_factor or flt(item_row.conversion_factor) == 0:
                                frappe.throw(_("Conversion factor missing or zero for item {0} with UOM {1} (Stock UOM: {2})").format(
                                    item_row.item_code, item_row.uom, item_details_for_stock_check.stock_uom
                                ))
                            qty_in_stock_uom = flt(item_row.qty) * flt(item_row.conversion_factor)
                        if not erpnext_allow_negative_stock and flt(qty_in_stock_uom) > flt(actual_available_qty):
                            error_msg = _("Item {0}: Insufficient stock in Warehouse {1}. Available: {2}, Requested (in stock UOM {4}): {3}.").format(
                                item_row.item_code, item_row.warehouse, actual_available_qty, qty_in_stock_uom, item_details_for_stock_check.stock_uom
                            )
                            raise frappe.exceptions.ValidationError(error_msg)

            # === Pre-Insert Validations (Continued) ===
            if hasattr(invoice_doc, 'validate_selling_price_list'): invoice_doc.validate_selling_price_list()
            if hasattr(invoice_doc, 'validate_price_list_currency'): invoice_doc.validate_price_list_currency()
            if doctype == "POS Invoice":
                if hasattr(invoice_doc, 'validate_pos_fields'): invoice_doc.validate_pos_fields()
                if hasattr(invoice_doc, 'validate_write_off_account'): invoice_doc.validate_write_off_account()
            else: # Sales Invoice
                if hasattr(invoice_doc, 'validate_debit_to_acc'): invoice_doc.validate_debit_to_acc()
            if hasattr(invoice_doc, 'validate_items'): invoice_doc.validate_items() 
            if hasattr(invoice_doc, 'validate_item_wise_tax_detail'): invoice_doc.validate_item_wise_tax_detail()
            if hasattr(invoice_doc, 'calculate_taxes_and_totals'): invoice_doc.calculate_taxes_and_totals()
            if invoice_doc.loyalty_program and hasattr(invoice_doc, 'validate_loyalty_points'):
                invoice_doc.validate_loyalty_points(invoice_doc.loyalty_points) 
            if doctype == "POS Invoice":
                if hasattr(invoice_doc, 'set_status'): invoice_doc.set_status(update=True) 
                if hasattr(invoice_doc, 'set_advances'): invoice_doc.set_advances()

            invoice_doc.flags.ignore_permissions = True 
            invoice_doc.insert() 
            current_invoice_doc_name_for_rollback = invoice_doc.name 
            invoice_doc.submit()

            results.append({
                "name": original_offline_tx_name,
                "success": True,
                "doc_id": invoice_doc.name,
                "message": f"{doctype} {invoice_doc.name} created and submitted successfully."
            })
        except frappe.ValidationError as e: # Catches stock validation errors too
            frappe.log_error(message=frappe.get_traceback(), title=f"POS Custom API: Validation Error for Offline TX '{original_offline_tx_name}'")
            if current_invoice_doc_name_for_rollback and frappe.db.exists(doctype, current_invoice_doc_name_for_rollback):
                 doc_to_delete = frappe.get_doc(doctype, current_invoice_doc_name_for_rollback)
                 if not doc_to_delete.docstatus.is_submitted():
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
                if not doc_to_delete.docstatus.is_submitted():
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
    doctypes_to_sync = {
        "Item": ["item_code", "item_name", "description", "stock_uom", "is_stock_item", "has_serial_no", "has_batch_no", "image", "item_group", "brand", "disabled", "weight_per_unit", "weight_uom", "barcodes.barcode", "barcodes.uom"],
        "Item Price": ["price_list", "item_code", "price_list_rate", "currency", "uom", "valid_from", "valid_upto", "item_name", "packing_unit"],
        "Customer": ["name", "customer_name", "customer_group", "default_price_list", "loyalty_program", "credit_limit", "disabled", "email_id", "mobile_no", "tax_id", "customer_primary_address"],
        "POS Profile": ["name", "company", "warehouse", "currency", "selling_price_list", "customer_groups", "item_groups", "payments", "hide_images", "allow_rate_change", "allow_discount_change", "update_stock", "income_account", "expense_account", "cost_center"], 
        "Warehouse": ["name", "warehouse_name", "is_group", "company", "disabled"],
        "UOM": ["name", "uom_name", "must_be_whole_number"],
        "Brand": ["name", "description", "disabled"],
        "Item Group": ["name", "item_group_name", "parent_item_group", "is_group", "disabled", "income_account", "expense_account", "cost_center"],
        "Customer Group": ["name", "parent_customer_group", "is_group", "disabled", "default_price_list"],
        "Sales Taxes and Charges Template": ["name", "title", "is_default", "company", "disabled"],
        "Payment Mode": ["name", "mode_of_payment", "type", "disabled"],
        # Add POS Receipt Template if it needs to be synced this way
        # "POS Receipt Template": ["name", "template_name", "company", "pos_profile", "is_default", ...] 
    }

    for doctype, fields_to_fetch in doctypes_to_sync.items():
        filters_dict = {"modified": (">", last_sync_dt)}
        meta = frappe.get_meta(doctype)
        if meta.has_field("company") and doctype not in ["Company"]: 
            filters_dict["company"] = company
        
        if doctype == "Item":
            if pos_profile.item_groups:
                item_group_list = [ig.item_group for ig in pos_profile.item_groups if ig.item_group]
                if item_group_list: filters_dict["item_group"] = ("in", item_group_list)
            filters_dict["is_sales_item"] = 1
            filters_dict["has_variants"] = 0
        
        if doctype == "Item Price":
            price_lists_to_consider = []
            if pos_profile.selling_price_list: price_lists_to_consider.append(pos_profile.selling_price_list)
            if pos_profile.customer_groups:
                for cg_entry in pos_profile.customer_groups:
                    if cg_entry.customer_group:
                        cg_pl = frappe.db.get_value("Customer Group", cg_entry.customer_group, "default_price_list", cache=True)
                        if cg_pl and cg_pl not in price_lists_to_consider:
                            price_lists_to_consider.append(cg_pl)
            if not price_lists_to_consider: continue
            filters_dict["price_list"] = ("in", list(set(price_lists_to_consider)))
            filters_dict["selling"] = 1
        
        if doctype == "POS Profile": filters_dict["name"] = pos_profile_name
        if doctype == "Customer":
             if pos_profile.customer_groups:
                cg_list = [cg.customer_group for cg in pos_profile.customer_groups if cg.customer_group]
                if cg_list: filters_dict["customer_group"] = ("in", cg_list)

        final_fields_to_fetch = ["name"] + [f for f in fields_to_fetch if f != "name"]
        docs = frappe.get_list(doctype, filters=filters_dict, fields=final_fields_to_fetch, ignore_permissions=True)
        
        if doctype in ["POS Profile", "Sales Taxes and Charges Template", "Payment Mode"] and docs: # Consider if POS Receipt Template needs full doc sync
            full_docs_list = []
            for d in docs:
                try:
                    full_doc = frappe.get_doc(doctype, d.name).as_dict()
                    full_docs_list.append(full_doc)
                except frappe.DoesNotExistError:
                    frappe.log_error(f"Document {doctype} {d.name} not found during get_updated_master_data full fetch.")
            docs = full_docs_list

        if docs: updated_data[doctype] = docs
            
    deleted_doc_entries = frappe.get_all("Deleted Document",
        filters={"creation": (">", last_sync_dt), "deleted_doctype": ("in", list(doctypes_to_sync.keys()))},
        fields=["deleted_doctype", "docname"], ignore_permissions=True)
    if deleted_doc_entries:
        deleted_map = {}
        for entry in deleted_doc_entries:
            deleted_map.setdefault(entry.deleted_doctype, []).append(entry.docname)
        if deleted_map: updated_data["DeletedDocuments"] = deleted_map
    return updated_data

# ---- Non-whitelisted helper functions below ----

def _get_items_and_prices_for_pos(pos_profile, company):
    items_conditions = {"disabled": 0, "is_sales_item": 1, "has_variants": 0}
    if pos_profile.item_groups:
        item_group_list = [ig.item_group for ig in pos_profile.item_groups if ig.item_group] 
        if item_group_list: items_conditions["item_group"] = ("in", item_group_list)
    if frappe.get_meta("Item").has_field("company"): items_conditions["company"] = company
    items_fields = [
        "name as item_code", "item_name", "description", "stock_uom", "item_group", "brand",
        "is_stock_item", "has_serial_no", "has_batch_no", "image", "disabled", "weight_per_unit", "weight_uom",
        "income_account", "opening_stock", "valuation_rate", 
        "`tabItem Barcode`.barcode", "`tabItem Barcode`.uom as barcode_uom"
    ]
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

    item_prices_data = []
    price_lists_to_fetch = []
    if pos_profile.selling_price_list: price_lists_to_fetch.append(pos_profile.selling_price_list)
    if pos_profile.customer_groups:
        for cg_entry in pos_profile.customer_groups:
            if cg_entry.customer_group:
                cg_pl = frappe.db.get_value("Customer Group", cg_entry.customer_group, "default_price_list", cache=True)
                if cg_pl and cg_pl not in price_lists_to_fetch:
                    price_lists_to_fetch.append(cg_pl)
    if item_codes and price_lists_to_fetch:
        item_prices_data = frappe.get_list("Item Price",
                                          filters={"item_code": ("in", item_codes), "price_list": ("in", list(set(price_lists_to_fetch))), "selling": 1},
                                          fields=["item_code", "price_list", "price_list_rate", "currency", "uom", "valid_from", "valid_upto", "item_name", "packing_unit"],
                                          ignore_permissions=True)
    return items, item_prices_data

def _get_warehouses_for_pos(pos_profile, company):
    warehouse_list = []
    if pos_profile.warehouse: warehouse_list.append(pos_profile.warehouse)
    if not warehouse_list: 
        company_default_warehouse = frappe.db.get_value("Company", company, "default_warehouse")
        if company_default_warehouse:
            warehouse_list.append(company_default_warehouse)
            frappe.log_message(f"POS Profile {pos_profile.name} has no warehouse. Using company default: {company_default_warehouse}", "POS Custom API")
        else:
             frappe.throw(_("No warehouse specified in POS Profile '{0}' and no Company Default Warehouse found. Please configure warehouses.").format(pos_profile.name))
    return frappe.get_list("Warehouse",
                           filters={"name": ("in", list(set(warehouse_list))), "is_group":0, "disabled":0, "company":company},
                           fields=["name", "warehouse_name", "is_group", "company"], 
                           ignore_permissions=True) 

def _get_stock_levels_snapshot(items_data, warehouses_data):
    stock_levels = []
    stock_item_codes = [item.item_code for item in items_data if item.is_stock_item]
    warehouse_names = [wh.name for wh in warehouses_data]
    if not stock_item_codes or not warehouse_names: return []
    for item_code in stock_item_codes:
        for wh_name in warehouse_names:
            try:
                actual_qty = get_bin_qty(item_code, wh_name) 
                stock_levels.append({"item_code": item_code, "warehouse": wh_name, "actual_qty": actual_qty, "timestamp": now_datetime()})
            except Exception as e:
                frappe.log_error(message=f"Error fetching stock for {item_code} in {wh_name}: {str(e)}", title="POS Custom API Stock Snapshot Error")
                stock_levels.append({"item_code": item_code, "warehouse": wh_name, "actual_qty": 0, "timestamp": now_datetime(), "error": "Error fetching stock"})
    return stock_levels

def _get_customers_for_pos(pos_profile, company):
    customer_list_from_groups = []
    if pos_profile.customer_groups:
        cg_list = [cg.customer_group for cg in pos_profile.customer_groups if cg.customer_group] 
        if cg_list:
            customers_in_groups = frappe.get_list("Customer", filters={"customer_group": ("in", cg_list), "disabled": 0, "company":company}, fields=["name"], ignore_permissions=True)
            customer_list_from_groups = [c.name for c in customers_in_groups]

    all_customer_names_to_fetch = set(customer_list_from_groups)
    if pos_profile.customer: 
        all_customer_names_to_fetch.add(pos_profile.customer)
    
    global_walk_in_customer = frappe.db.get_single_value('Selling Settings', 'pos_walk_in_customer')
    if global_walk_in_customer:
        all_customer_names_to_fetch.add(global_walk_in_customer)
    
    if not all_customer_names_to_fetch: 
        frappe.log_message("POS Custom API", f"No specific customers identified for POS Profile {pos_profile.name}. Customer list for initial sync might be empty.", level=frappe.LOG_DEBUG)
        return []

    customer_fields = ["name", "customer_name", "customer_group", "default_price_list", "loyalty_program", "credit_limit", "email_id", "mobile_no", "disabled", "tax_id", "customer_primary_address", "default_sales_partner", "default_commission_rate"]
    
    customers = []
    if all_customer_names_to_fetch:
        active_customer_filters = {"name": ("in", list(all_customer_names_to_fetch)), "disabled": 0}
        if frappe.get_meta("Customer").has_field("company") and company: 
            active_customer_filters["company"] = company
        
        customers = frappe.get_list("Customer",
                                   filters=active_customer_filters,
                                   fields=customer_fields,
                                   ignore_permissions=True)
    
    critical_default_names = []
    if global_walk_in_customer: critical_default_names.append(global_walk_in_customer)
    if pos_profile.customer and pos_profile.customer not in critical_default_names:
         critical_default_names.append(pos_profile.customer)

    for cust_name in critical_default_names:
        is_already_fetched = any(c.name == cust_name for c in customers)
        if not is_already_fetched:
            try:
                cust_doc = frappe.get_doc("Customer", cust_name)
                if cust_doc.company == company: # Ensure customer belongs to the correct company
                     customer_data = {"name": cust_doc.name}
                     for field_name_spec in customer_fields:
                         original_field_name = field_name_spec.split(" as ")[0].strip("`").split(".")[-1]
                         if field_name_spec == "name": continue
                         if hasattr(cust_doc, original_field_name):
                             customer_data[field_name_spec if " as " in field_name_spec else original_field_name] = getattr(cust_doc, original_field_name)
                         else:
                             customer_data[field_name_spec if " as " in field_name_spec else original_field_name] = None
                     customers.append(customer_data)
                else:
                    frappe.log_message("POS Custom API", f"Default customer {cust_name} (Company: {cust_doc.company}) does not belong to the POS Profile's company ({company}). Not adding.", level=frappe.LOG_WARNING)
            except frappe.DoesNotExistError:
                frappe.log_message("POS Custom API", f"A critical default customer '{cust_name}' was not found in the database.", level=frappe.LOG_WARNING)
            
    return customers

[end of erpnext/pos_custom_api.py]
