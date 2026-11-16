#!/usr/bin/env python3
"""
Create Test Users for the Billing Platform
Creates both admin and regular users for testing
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def create_test_users():
    """Create test users for the billing platform"""
    
    print("🧪 Creating Test Users for Billing Platform")
    print("=" * 50)
    
    # Test users to create
    users = [
        {
            "full_name": "Admin User",
            "email": "admin@test.com",
            "password": "admin123",
            "role": "admin"
        },
        {
            "full_name": "Sai Kumar",
            "email": "sai@gmail.com", 
            "password": "sai123",
            "role": "user"
        },
        {
            "full_name": "Test User",
            "email": "test@example.com",
            "password": "test123", 
            "role": "user"
        },
        {
            "full_name": "Demo Customer",
            "email": "demo@test.com",
            "password": "demo123",
            "role": "user"
        }
    ]
    
    created_users = []
    existing_users = []
    
    for user in users:
        try:
            response = requests.post(f"{BASE_URL}/signup", json=user)
            if response.status_code == 200:
                print(f"✅ Created: {user['email']} ({user['role']})")
                created_users.append(user)
            else:
                error_detail = response.json().get('detail', 'Unknown error')
                if 'already registered' in error_detail:
                    print(f"ℹ️  Exists: {user['email']} ({user['role']})")
                    existing_users.append(user)
                else:
                    print(f"❌ Failed: {user['email']} - {error_detail}")
        except Exception as e:
            print(f"❌ Error creating {user['email']}: {e}")
    
    print("\n" + "=" * 50)
    print("🎯 TEST ACCOUNT SUMMARY")
    print("=" * 50)
    
    print("\n📋 Available Test Accounts:")
    for user in users:
        role_emoji = "🔑" if user['role'] == 'admin' else "👤"
        print(f"{role_emoji} {user['email']} / {user['password']} ({user['role']})")
    
    print(f"\n📊 Results:")
    print(f"   ✅ Created: {len(created_users)} accounts")
    print(f"   ℹ️  Existing: {len(existing_users)} accounts") 
    print(f"   📁 Total Available: {len(users)} accounts")
    
    print(f"\n🌐 Frontend URL: http://localhost:5173")
    print(f"🔧 Backend API: http://localhost:8000")
    print(f"📚 API Docs: http://localhost:8000/docs")
    
    return created_users, existing_users

if __name__ == "__main__":
    create_test_users()