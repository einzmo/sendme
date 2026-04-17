# app/utils/email.py
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import current_app

def send_verification_email(to_email, verification_code, username):
    """Send verification email to user"""
    
    subject = "SendMe - Verify Your Email Address"
    
    # HTML email body
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{
                font-family: 'Inter', Arial, sans-serif;
                background-color: #0F172A;
                margin: 0;
                padding: 20px;
            }}
            .container {{
                max-width: 500px;
                margin: 0 auto;
                background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
                border-radius: 20px;
                padding: 30px;
                border: 1px solid rgba(96, 165, 250, 0.2);
            }}
            .logo {{
                text-align: center;
                margin-bottom: 20px;
            }}
            .logo-text {{
                font-size: 28px;
                font-weight: bold;
                background: linear-gradient(135deg, #60A5FA, #1E3A8A);
                -webkit-background-clip: text;
                background-clip: text;
                color: transparent;
            }}
            h2 {{
                color: #F1F5F9;
                text-align: center;
                margin-bottom: 20px;
            }}
            .code {{
                background: rgba(37, 99, 235, 0.2);
                border: 1px solid rgba(96, 165, 250, 0.3);
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                margin: 20px 0;
            }}
            .code-number {{
                font-size: 36px;
                font-weight: bold;
                letter-spacing: 5px;
                color: #60A5FA;
                font-family: monospace;
            }}
            .message {{
                color: #94A3B8;
                text-align: center;
                line-height: 1.6;
                margin: 20px 0;
            }}
            .footer {{
                text-align: center;
                color: #64748B;
                font-size: 12px;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid rgba(96, 165, 250, 0.1);
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <span class="logo-text">SendMe</span>
            </div>
            <h2>Verify Your Email Address</h2>
            <div class="message">
                Hello <strong>{username}</strong>,<br>
                Thank you for joining SendMe! Please verify your email address to get full access to the platform.
            </div>
            <div class="code">
                <div class="code-number">{verification_code}</div>
                <div style="color: #94A3B8; font-size: 12px; margin-top: 10px;">Enter this code in the SendMe app</div>
            </div>
            <div class="message">
                This code will expire in 10 minutes.<br>
                If you didn't request this, please ignore this email.
            </div>
            <div class="footer">
                <p>SendMe - Quick Help, No Stress</p>
                <p>© 2024 SendMe. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Plain text fallback
    text_body = f"""
SendMe - Verify Your Email Address

Hello {username},

Thank you for joining SendMe! Please verify your email address.

Your verification code is: {verification_code}

Enter this code in the SendMe app to complete verification.

This code will expire in 10 minutes.

If you didn't request this, please ignore this email.

---
SendMe - Quick Help, No Stress
"""
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = current_app.config['EMAIL_FROM']
        msg['To'] = to_email
        
        # Attach parts
        part1 = MIMEText(text_body, 'plain')
        part2 = MIMEText(html_body, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email
        with smtplib.SMTP(current_app.config['EMAIL_HOST'], current_app.config['EMAIL_PORT']) as server:
            server.starttls()
            server.login(current_app.config['EMAIL_USER'], current_app.config['EMAIL_PASSWORD'])
            server.sendmail(current_app.config['EMAIL_FROM'], to_email, msg.as_string())
        
        return True, "Email sent successfully"
        
    except Exception as e:
        print(f"Email error: {e}")
        return False, str(e)