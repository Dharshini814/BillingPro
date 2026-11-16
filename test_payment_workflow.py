#!/usr/bin/env python3
"""
Test Script: Complete Payment Workflow Verification
Tests the user subscription → invoice generation → payment → retry workflow
"""

import requests
import json
import time
from datetime import datetime

# API Base URL
BASE_URL = "http://localhost:8000"

def test_payment_workflow():
    """Test the complete payment workflow as specified"""
    
    print("="*60)
    print("🧪 TESTING COMPLETE PAYMENT WORKFLOW")
    print("="*60)
    
    # Step 1: Create a test user
    print("\n1️⃣ Creating test user...")
    signup_data = {
        "full_name": "Test Customer",
        "email": f"testcustomer_{int(time.time())}@example.com",
        "password": "testpass123", 
        "role": "user"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/signup", json=signup_data)
        if response.status_code == 200:
            print(f"✅ User created: {signup_data['email']}")
        else:
            print(f"❌ Failed to create user: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating user: {e}")
        return False
    
    # Step 2: Login to get auth token
    print("\n2️⃣ Logging in...")
    login_data = {
        "email": signup_data["email"],
        "password": signup_data["password"]
    }
    
    try:
        response = requests.post(f"{BASE_URL}/login", json=login_data)
        if response.status_code == 200:
            auth_data = response.json()
            token = auth_data["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            print(f"✅ Login successful, got token")
        else:
            print(f"❌ Login failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error logging in: {e}")
        return False
    
    # Step 3: Create customer record or find existing one
    print("\n3️⃣ Creating/finding customer record...")
    
    # First try to find existing customer by email
    try:
        response = requests.get(f"{BASE_URL}/customers/?search={signup_data['email']}", headers=headers)
        if response.status_code == 200:
            customers_data = response.json()
            customers = customers_data.get("items", [])
            
            existing_customer = next((c for c in customers if c["email"] == signup_data["email"]), None)
            
            if existing_customer:
                customer_id = existing_customer["id"]
                print(f"✅ Found existing customer with ID: {customer_id}")
            else:
                # Create new customer
                customer_data = {
                    "name": signup_data["full_name"],
                    "email": signup_data["email"],
                    "company_name": "Test Company",
                    "country": "India",
                    "currency": "INR"
                }
                
                response = requests.post(f"{BASE_URL}/customers/", json=customer_data, headers=headers)
                if response.status_code == 200:
                    customer = response.json()
                    customer_id = customer["id"]
                    print(f"✅ Customer created with ID: {customer_id}")
                else:
                    print(f"❌ Failed to create customer: {response.text}")
                    return False
        else:
            print(f"❌ Failed to search for customers: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error finding/creating customer: {e}")
        return False
    
    # Step 4: Get available plans
    print("\n4️⃣ Getting available plans...")
    try:
        response = requests.get(f"{BASE_URL}/plans/", headers=headers)
        if response.status_code == 200:
            plans = response.json()
            if plans:
                selected_plan = plans[0]  # Use first plan
                print(f"✅ Found {len(plans)} plans, selected: {selected_plan['name']} (₹{selected_plan['price']})")
            else:
                print("❌ No plans available")
                return False
        else:
            print(f"❌ Failed to get plans: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error getting plans: {e}")
        return False
    
    # Step 5: Subscribe to plan (this should generate unpaid invoice automatically)
    print(f"\n5️⃣ Subscribing to plan: {selected_plan['name']}...")
    subscription_data = {
        "plan_id": selected_plan["id"],
        "customer_id": customer_id  # Use customer_id instead of email
    }
    
    try:
        response = requests.post(f"{BASE_URL}/subscriptions/", json=subscription_data, headers=headers)
        if response.status_code == 200:
            subscription = response.json()
            print(f"✅ Subscription created!")
            print(f"   Subscription ID: {subscription.get('id')}")
            print(f"   Invoice Number: {subscription.get('invoiceNumber')}")
            print(f"   Invoice Status: {subscription.get('invoiceStatus')}")
            
            invoice_id = subscription.get("invoiceId")
            if not invoice_id:
                print("❌ No invoice ID in subscription response")
                return False
        else:
            print(f"❌ Failed to create subscription: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating subscription: {e}")
        return False
    
    # Step 6: Verify unpaid invoice shows in user dashboard
    print(f"\n6️⃣ Checking user invoices dashboard...")
    try:
        response = requests.get(f"{BASE_URL}/invoices/?customer_email={signup_data['email']}", headers=headers)
        if response.status_code == 200:
            invoices_data = response.json()
            user_invoices = invoices_data.get("items", [])
            
            unpaid_invoices = [inv for inv in user_invoices if inv["status"] == "unpaid"]
            print(f"✅ Found {len(user_invoices)} total invoices, {len(unpaid_invoices)} unpaid")
            
            if unpaid_invoices:
                target_invoice = unpaid_invoices[0]
                print(f"   Target Invoice: {target_invoice['number']} - ₹{target_invoice['amount']} ({target_invoice['status']})")
            else:
                print("❌ No unpaid invoices found")
                return False
        else:
            print(f"❌ Failed to get user invoices: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error getting user invoices: {e}")
        return False
    
    # Step 7: Test payment processing with 50% success rate
    print(f"\n7️⃣ Testing payment processing (50% success rate)...")
    payment_methods = ["upi", "card", "wallet"]
    
    for attempt in range(3):  # Try up to 3 payments to test success/failure
        method = payment_methods[attempt % len(payment_methods)]
        print(f"\n   Payment attempt {attempt + 1} with {method.upper()}...")
        
        payment_data = {
            "invoice_id": invoice_id,
            "amount": target_invoice["amount"],
            "payment_method": method
        }
        
        try:
            response = requests.post(f"{BASE_URL}/payments/process", json=payment_data, headers=headers)
            if response.status_code == 200:
                payment_result = response.json()
                success = payment_result.get("success", False)
                
                if success:
                    print(f"   ✅ Payment SUCCESS with {method.upper()}")
                    print(f"      Transaction ID: {payment_result.get('transaction_id')}")
                    print(f"      Payment Reference: {payment_result.get('payment_reference')}")
                    print(f"      Invoice Status: {payment_result.get('invoice_status')}")
                    break  # Exit loop on successful payment
                else:
                    print(f"   ❌ Payment FAILED with {method.upper()}")
                    print(f"      Message: {payment_result.get('message')}")
                    print(f"      Invoice Status: {payment_result.get('invoice_status')}")
            else:
                print(f"   ❌ Payment API error: {response.text}")
        except Exception as e:
            print(f"   ❌ Error processing payment: {e}")
        
        time.sleep(1)  # Brief pause between attempts
    
    # Step 8: Check final invoice status
    print(f"\n8️⃣ Checking final invoice status...")
    try:
        response = requests.get(f"{BASE_URL}/invoices/?customer_email={signup_data['email']}", headers=headers)
        if response.status_code == 200:
            invoices_data = response.json()
            user_invoices = invoices_data.get("items", [])
            
            for inv in user_invoices:
                if inv["id"] == invoice_id:
                    print(f"✅ Final Invoice Status: {inv['status']}")
                    print(f"   Invoice: {inv['number']} - ₹{inv['amount']}")
                    break
        else:
            print(f"❌ Failed to get final invoice status: {response.text}")
    except Exception as e:
        print(f"❌ Error getting final invoice status: {e}")
    
    # Step 9: Check retry queue (if payment failed)
    print(f"\n9️⃣ Checking payment retry queue...")
    try:
        response = requests.get(f"{BASE_URL}/payment-retries/?status=pending", headers=headers)
        if response.status_code == 200:
            retries_data = response.json()
            retries = retries_data.get("items", [])
            
            relevant_retries = [r for r in retries if r["invoiceId"] == invoice_id]
            print(f"✅ Found {len(relevant_retries)} pending retries for this invoice")
            
            for retry in relevant_retries:
                print(f"   Retry #{retry['attemptNumber']} scheduled for {retry['scheduledDate']}")
        else:
            print(f"❌ Failed to get retry queue: {response.text}")
    except Exception as e:
        print(f"❌ Error getting retry queue: {e}")
    
    print("\n" + "="*60)
    print("🎯 PAYMENT WORKFLOW TEST COMPLETED")
    print("="*60)
    return True

if __name__ == "__main__":
    test_payment_workflow()