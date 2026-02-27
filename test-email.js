// Test email sending
const nodemailer = require('nodemailer');

async function testEmail() {
  try {
    console.log('Starting email test...');
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '***set***' : 'NOT SET');
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    console.log('Transporter created. Attempting to send...');

    const info = await transporter.sendMail({
      from: 'danskien31@gmail.com',
      to: 'danskien31@gmail.com',
      subject: 'Test Email from DepEd',
      html: '<h1>Test Email</h1><p>This is a test OTP: 654321</p>',
    });

    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('❌ Email sending failed:');
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

testEmail();
