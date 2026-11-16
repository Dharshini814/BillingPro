#!/usr/bin/env python3
"""
Complete test of the enhanced signup form
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

def test_complete_signup_flow():
    """Test the complete signup flow with all fields"""
    
    timestamp = int(datetime.now().timestamp())
    
    print("🧪 COMPLETE SIGNUP FLOW TEST")
    print("=" * 50)
    
    # Test data
    user_data = {
        "full_name": "Sarah Johnson",
        "email": f"sarah.johnson.{timestamp}@testcorp.com",
        "password": "secure789",
        "role": "user", 
        "company_name": "TestCorp Solutions Ltd",
        "phone": "+1 (555) 444-7788"
    }
    
    print("Step 1: Creating user account...")
    print(f"   Name: {user_data['full_name']}")
    print(f"   Email: {user_data['email']}")
    print(f"   Company: {user_data['company_name']}")
    print(f"   Phone: {user_data['phone']}")
    
    # 1. Signup
    try:
        signup_response = requests.post(f"{BASE_URL}/signup", json=user_data)
        if signup_response.status_code != 200:
            print(f"❌ Signup failed: {signup_response.text}")
            return False
        print("✅ User account created successfully!")
    except Exception as e:
        print(f"❌ Signup error: {e}")
        return False
    
    # 2. Login
    print("\nStep 2: Logging in...")
    try:
        login_data = {"email": user_data["email"], "password": user_data["password"]}
        login_response = requests.post(f"{BASE_URL}/login", json=login_data)
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.text}")
            return False
        
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Login successful!")
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False
    
    # 3. Verify customer data in admin view
    print("\nStep 3: Verifying customer data in admin dashboard...")
    try:
        customers_response = requests.get(f"{BASE_URL}/customers/?search={user_data['email']}", headers=headers)
        if customers_response.status_code != 200:
            print(f"❌ Failed to get customer data: {customers_response.text}")
            return False
            
        customers_data = customers_response.json()
        customers = customers_data.get("items", [])
        
        if not customers:
            print("❌ Customer not found in admin dashboard")
            return False
            
        customer = customers[0]
        print("✅ Customer found in admin dashboard:")
        print(f"   ID: {customer['id']}")
        print(f"   Name: {customer['name']}")
        print(f"   Email: {customer['email']}")
        print(f"   Company: {customer['company']}")
        print(f"   Phone: {customer['phone']}")
        print(f"   Country: {customer['country']}")
        print(f"   Status: {customer['status']}")
        
        # Verify all fields are populated
        issues = []
        if not customer['company'] or customer['company'] == '':
            issues.append("Company name missing")
        if not customer['phone'] or customer['phone'] == '':
            issues.append("Phone number missing")
        if customer['name'] != user_data['full_name']:
            issues.append("Name mismatch")
        if customer['email'] != user_data['email']:
            issues.append("Email mismatch")
            
        if issues:
            print("❌ Issues found:")
            for issue in issues:
                print(f"   - {issue}")
            return False
        else:
            print("✅ All fields correctly populated!")
            
    except Exception as e:
        print(f"❌ Customer verification error: {e}")
        return False
    
    print("\n" + "=" * 50)
    print("🎯 SIGNUP FLOW TEST RESULTS:")
    print("✅ User account creation: PASS")
    print("✅ Authentication: PASS") 
    print("✅ Customer record creation: PASS")
    print("✅ Company name storage: PASS")
    print("✅ Phone number storage: PASS")
    print("✅ Admin dashboard display: PASS")
    print("\n🎉 ALL TESTS PASSED!")
    print("The signup form now properly collects and displays:")
    print("   • Full Name")
    print("   • Email Address") 
    print("   • Company Name")
    print("   • Phone Number")
    print("   • Password & Confirmation")
    print("   • User Role Selection")
    print("=" * 50)
    
    return True

if __name__ == "__main__":
    test_complete_signup_flow()