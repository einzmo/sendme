# test_email.py
from app import create_app
from app.utils.email import send_verification_email

app = create_app()

with app.app_context():
    success, message = send_verification_email("your-test-email@gmail.com", "123456", "TestUser")
    print(f"Success: {success}")
    print(f"Message: {message}")