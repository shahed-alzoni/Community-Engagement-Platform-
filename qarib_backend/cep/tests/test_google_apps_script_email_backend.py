import json
from io import BytesIO
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from django.core.mail import EmailMessage, EmailMultiAlternatives
from django.test import SimpleTestCase, override_settings

from cep.email_backends import GoogleAppsScriptEmailBackend


@override_settings(
    GOOGLE_APPS_SCRIPT_URL='https://script.google.com/macros/s/test/exec',
    GOOGLE_APPS_SCRIPT_TOKEN='test-only-token',
    EMAIL_TIMEOUT=10,
)
class GoogleAppsScriptEmailBackendTests(SimpleTestCase):
    def setUp(self):
        self.message = EmailMessage('Verify', 'Your code is 123456', to=['user@example.com'])

    @patch('cep.email_backends.urlopen')
    def test_sends_json_and_accepts_ok_true(self, urlopen):
        urlopen.return_value.__enter__.return_value = BytesIO(b'{"ok": true}')

        self.assertEqual(GoogleAppsScriptEmailBackend().send_messages([self.message]), 1)
        request = urlopen.call_args.args[0]
        self.assertEqual(request.get_method(), 'POST')
        self.assertEqual(request.full_url, 'https://script.google.com/macros/s/test/exec')
        self.assertEqual(request.get_header('Content-type'), 'application/json; charset=utf-8')
        self.assertEqual(urlopen.call_args.kwargs['timeout'], 10)
        self.assertEqual(
            json.loads(request.data),
            {'token': 'test-only-token', 'to': 'user@example.com', 'subject': 'Verify', 'text': 'Your code is 123456'},
        )

    @override_settings(EMAIL_BACKEND='cep.email_backends.GoogleAppsScriptEmailBackend')
    @patch('cep.email_backends.urlopen')
    def test_django_email_message_uses_configured_backend(self, urlopen):
        urlopen.return_value.__enter__.return_value = BytesIO(b'{"ok": true}')

        self.assertEqual(self.message.send(), 1)
        urlopen.assert_called_once()

    @patch('cep.email_backends.urlopen')
    def test_password_reset_html_message_uses_text_body(self, urlopen):
        urlopen.return_value.__enter__.return_value = BytesIO(b'{"ok": true}')
        message = EmailMultiAlternatives('Reset', 'Plain reset link', to=['user@example.com'])
        message.attach_alternative('<a href="https://example.com">Reset</a>', 'text/html')

        self.assertEqual(GoogleAppsScriptEmailBackend().send_messages([message]), 1)
        self.assertEqual(json.loads(urlopen.call_args.args[0].data)['text'], 'Plain reset link')

    @patch('cep.email_backends.urlopen')
    def test_rejects_false_or_invalid_json_without_leaking_response(self, urlopen):
        for body in (b'{"ok": false, "secret": "sensitive"}', b'not json'):
            with self.subTest(body=body):
                urlopen.return_value.__enter__.return_value = BytesIO(body)
                with self.assertRaisesRegex(OSError, r'^Google Apps Script email delivery failed\.$') as caught:
                    GoogleAppsScriptEmailBackend().send_messages([self.message])
                self.assertNotIn('sensitive', str(caught.exception))

    @patch('cep.email_backends.urlopen')
    def test_handles_timeout_and_http_errors(self, urlopen):
        for error in (TimeoutError('private URL'), URLError('private URL'), HTTPError('private URL', 500, 'secret', {}, None)):
            with self.subTest(error=type(error).__name__):
                urlopen.side_effect = error
                with self.assertRaisesRegex(OSError, r'^Google Apps Script email delivery failed\.$'):
                    GoogleAppsScriptEmailBackend().send_messages([self.message])

    @patch('cep.email_backends.urlopen', side_effect=TimeoutError('private URL'))
    def test_fail_silently_returns_zero(self, _urlopen):
        self.assertEqual(GoogleAppsScriptEmailBackend(fail_silently=True).send_messages([self.message]), 0)
