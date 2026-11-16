#!/usr/bin/env python3
"""
Test the updated signup form with phone and company details
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_signup_with_details():
    """Test signup with phone and company details"""
    
    print("🧪 Testing Signup with Phone & Company Details")
    print("=" * 50)
    
    # Test user with complete details
    user_data = {
        "full_name": "John Smith",
        "email": "john.smith@company.com",
        "password": "secure123",
        "role": "user",
        "company_name": "Tech Solutions Inc",
        "phone": "+1 (555) 123-4567"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/signup", json=user_data)
        if response.status_code == 200:
            print("✅ Signup successful!")
            print(f"   User: {user_data['full_name']}")
            print(f"   Email: {user_data['email']}")
            print(f"   Company: {user_data['company_name']}")
            print(f"   Phone: {user_data['phone']}")
            
            # Now test login to verify
            login_data = {
                "email": user_data["email"],
                "password": user_data["password"]
            }
            
            login_response = requests.post(f"{BASE_URL}/login", json=login_data)
            if login_response.status_code == 200:
                print("✅ Login successful!")
                token = login_response.json()["access_token"]
                headers = {"Authorization": f"Bearer {token}"}
                
                # Check if customer record was created with phone/company
                customers_response = requests.get(f"{BASE_URL}/customers/?search={user_data['email']}", headers=headers)
                if customers_response.status_code == 200:
                    customers = customers_response.json().get("items", [])
                    customer = next((c for c in customers if c["email"] == user_data["email"]), None)
                    
                    if customer:
                        print("✅ Customer record created!")
                        print(f"   Name: {customer.get('name', 'N/A')}")
                        print(f"   Company: {customer.get('company', 'N/A')}")
                        print(f"   Phone: {customer.get('phone', 'N/A')}")  # Check if phone is there
                        
                        if customer.get('company') and customer.get('company') != '':
                            print("✅ Company name saved correctly!")
                        else:
                            print("❌ Company name not saved")
                            
                    else:
                        print("❌ Customer record not found")
                else:
                    print(f"❌ Failed to get customers: {customers_response.text}")
            else:
                print(f"❌ Login failed: {login_response.text}")
        else:
            error_detail = response.json().get('detail', 'Unknown error')
            if 'already registered' in error_detail:
                print(f"ℹ️  User already exists: {user_data['email']}")
            else:
                print(f"❌ Signup failed: {error_detail}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_signup_with_details()