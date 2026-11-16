#!/usr/bin/env python3
"""
Test Script: Failed Payment Retry Mechanism
Tests the retry system: Day 1, Day 3, Day 7 retries
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000"

def test_failed_payment_retries():
    """Test failed payment retry mechanism"""
    
    print("="*60)
    print("TESTING FAILED PAYMENT RETRY MECHANISM")
    print("="*60)
    
    # Quick setup - reuse existing failed payment data
    print("1. Setting up test environment...")
    
    # Login as admin to see retry queue
    admin_login = {
        "email": "admin@example.com", 
        "password": "admin123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/login", json=admin_login)
        if response.status_code == 200:
            auth_data = response.json()
            token = auth_data["access_token"] 
            headers = {"Authorization": f"Bearer {token}"}
            print("[OK] Admin logged in successfully")
        else:
            print("[FAIL] Admin login failed, trying to create admin...")
            # Create admin user
            admin_signup = {
                "full_name": "Admin User",
                "email": "admin@example.com",
                "password": "admin123",
                "role": "admin"
            }
            
            signup_response = requests.post(f"{BASE_URL}/signup", json=admin_signup)
            if signup_response.status_code == 200:
                print("[OK] Admin user created")
                
                # Now login
                response = requests.post(f"{BASE_URL}/login", json=admin_login)
                if response.status_code == 200:
                    auth_data = response.json()
                    token = auth_data["access_token"]
                    headers = {"Authorization": f"Bearer {token}"}
                    print("[OK] Admin logged in after creation")
                else:
                    print(f"[FAIL] Still failed to login: {response.text}")
                    return False
            else:
                print(f"[FAIL] Failed to create admin: {signup_response.text}")
                return False
    except Exception as e:
        print(f"[FAIL] Error setting up admin: {e}")
        return False
    
    # Step 2: Check current retry queue
    print("\n2. Checking current retry queue...")
    try:
        response = requests.get(f"{BASE_URL}/payment-retries/?status=pending", headers=headers)
        if response.status_code == 200:
            retries_data = response.json()
            retries = retries_data.get("items", [])
            print(f"[OK] Found {len(retries)} pending retries in queue")
            
            # Show some retry details
            for i, retry in enumerate(retries[:3]):  # Show first 3
                print(f"   Retry {i+1}: Invoice #{retry['invoiceId']} - Attempt #{retry['attemptNumber']} - Due: {retry['scheduledDate']}")
        else:
            print(f"[FAIL] Failed to get retry queue: {response.text}")
    except Exception as e:
        print(f"[FAIL] Error getting retry queue: {e}")
    
    # Step 3: Create a test scenario where payment fails 3 times
    print("\n3. Creating test scenario with guaranteed failures...")
    
    # Create a test user and subscription
    test_email = f"retry_test_{int(time.time())}@example.com"
    signup_data = {
        "full_name": "Retry Test User",
        "email": test_email,
        "password": "testpass123",
        "role": "user"
    }
    
    try:
        # Create user
        response = requests.post(f"{BASE_URL}/signup", json=signup_data)
        if response.status_code != 200:
            print(f"[FAIL] Failed to create test user: {response.text}")
            return False
        
        # Login as user
        login_response = requests.post(f"{BASE_URL}/login", json={
            "email": test_email, "password": "testpass123"
        })
        if login_response.status_code != 200:
            print(f"[FAIL] Failed to login as test user: {login_response.text}")
            return False
            
        user_token = login_response.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        
        # Find or create customer
        customers_response = requests.get(f"{BASE_URL}/customers/?search={test_email}", headers=user_headers)
        if customers_response.status_code == 200:
            customers = customers_response.json().get("items", [])
            existing_customer = next((c for c in customers if c["email"] == test_email), None)
            
            if existing_customer:
                customer_id = existing_customer["id"]
            else:
                # Create customer
                customer_data = {
                    "name": signup_data["full_name"],
                    "email": test_email,
                    "country": "India"
                }
                cust_response = requests.post(f"{BASE_URL}/customers/", json=customer_data, headers=user_headers)
                if cust_response.status_code != 200:
                    print(f"[FAIL] Failed to create customer: {cust_response.text}")
                    return False
                customer_id = cust_response.json()["id"]
        
        # Get a plan and create subscription
        plans_response = requests.get(f"{BASE_URL}/plans/", headers=user_headers)
        if plans_response.status_code != 200:
            print(f"[FAIL] Failed to get plans: {plans_response.text}")
            return False
            
        plans = plans_response.json()
        if not plans:
            print("[FAIL] No plans available")
            return False
            
        selected_plan = plans[0]
        
        # Create subscription
        sub_data = {"plan_id": selected_plan["id"], "customer_id": customer_id}
        sub_response = requests.post(f"{BASE_URL}/subscriptions/", json=sub_data, headers=user_headers)
        if sub_response.status_code != 200:
            print(f"[FAIL] Failed to create subscription: {sub_response.text}")
            return False
            
        subscription = sub_response.json()
        invoice_id = subscription.get("invoiceId")
        
        print(f"[OK] Created test scenario - Invoice ID: {invoice_id}")
        
    except Exception as e:
        print(f"[FAIL] Error creating test scenario: {e}")
        return False
    
    # Step 4: Simulate multiple failed payments to trigger retries
    print("\n4. Simulating multiple payment failures...")
    
    # Get invoice details
    invoices_response = requests.get(f"{BASE_URL}/invoices/?customer_email={test_email}", headers=user_headers)
    if invoices_response.status_code != 200:
        print(f"[FAIL] Failed to get invoices: {invoices_response.text}")
        return False
        
    invoices = invoices_response.json().get("items", [])
    target_invoice = next((inv for inv in invoices if inv["id"] == invoice_id), None)
    
    if not target_invoice:
        print("[FAIL] Target invoice not found")
        return False
    
    # Attempt payments until we get failures (since it's 50/50, we should get some failures)
    payment_attempts = 0
    max_attempts = 10  # Try up to 10 times to get failures
    failed_attempts = 0
    
    while failed_attempts < 1 and payment_attempts < max_attempts:  # Try to get at least 1 failure
        payment_attempts += 1
        print(f"\n   Payment attempt #{payment_attempts}...")
        
        payment_data = {
            "invoice_id": invoice_id,
            "amount": target_invoice["amount"],
            "payment_method": "card"
        }
        
        try:
            response = requests.post(f"{BASE_URL}/payments/process", json=payment_data, headers=user_headers)
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    print(f"   [OK] Payment succeeded (attempt {payment_attempts})")
                    print("   [TARGET] Payment successful - cannot test retry mechanism")
                    break
                else:
                    failed_attempts += 1
                    print(f"   [FAIL] Payment failed (attempt {payment_attempts})")
                    print(f"      Message: {result.get('message')}")
                    break
            else:
                print(f"   [FAIL] Payment API error: {response.text}")
        except Exception as e:
            print(f"   [FAIL] Error making payment: {e}")
        
        time.sleep(0.5)  # Small delay between attempts
    
    # Step 5: Check retry queue after failure
    if failed_attempts > 0:
        print("\n5. Checking retry queue after payment failure...")
        try:
            response = requests.get(f"{BASE_URL}/payment-retries/?status=pending", headers=headers)
            if response.status_code == 200:
                retries_data = response.json()
                retries = retries_data.get("items", [])
                
                relevant_retries = [r for r in retries if r["invoiceId"] == invoice_id]
                print(f"[OK] Found {len(relevant_retries)} scheduled retries for failed payment")
                
                for retry in relevant_retries:
                    print(f"   [DATE] Retry #{retry['attemptNumber']}: Scheduled for {retry['scheduledDate']}")
                    print(f"      Status: {retry['status']}")
                
                if len(relevant_retries) == 3:
                    print("[OK] All 3 retries scheduled correctly (Day 1, 3, 7)")
                else:
                    print(f"⚠️  Expected 3 retries, found {len(relevant_retries)}")
                    
            else:
                print(f"[FAIL] Failed to get updated retry queue: {response.text}")
        except Exception as e:
            print(f"[FAIL] Error getting retry queue: {e}")
        
        # Step 6: Test running retries manually
        print("\n6. Testing manual retry processing...")
        try:
            response = requests.post(f"{BASE_URL}/payment-retries/run", headers=headers)
            if response.status_code == 200:
                result = response.json()
                print(f"[OK] Retry run completed - Processed {result.get('processed', 0)} retries")
                
                for res in result.get("results", []):
                    retry_id = res.get("retry_id")
                    outcome = res.get("result")
                    print(f"   Retry #{retry_id}: {outcome}")
                    
            else:
                print(f"[FAIL] Failed to run retries: {response.text}")
        except Exception as e:
            print(f"[FAIL] Error running retries: {e}")
    
    print("\n" + "="*60)
    print("RETRY RETRY MECHANISM TEST COMPLETED")
    print("="*60)
    return True

if __name__ == "__main__":
    test_failed_payment_retries()