import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend


class GoogleAppsScriptEmailBackend(BaseEmailBackend):
    """Send Django email messages through the private Apps Script web app."""

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        sent = 0
        for message in email_messages:
            recipients = message.recipients()
            if not recipients:
                continue

            for recipient in recipients:
                payload = json.dumps({
                    'token': settings.GOOGLE_APPS_SCRIPT_TOKEN,
                    'to': recipient,
                    'subject': message.subject,
                    'text': message.body,
                }).encode('utf-8')
                request = Request(
                    settings.GOOGLE_APPS_SCRIPT_URL,
                    data=payload,
                    headers={'Content-Type': 'application/json; charset=utf-8'},
                    method='POST',
                )
                try:
                    with urlopen(request, timeout=settings.EMAIL_TIMEOUT) as response:
                        result = json.load(response)
                    if not isinstance(result, dict) or result.get('ok') is not True:
                        raise ValueError('Apps Script did not confirm delivery')
                except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError):
                    if self.fail_silently:
                        return sent
                    # Never propagate response bodies, URLs or credentials into logs.
                    raise OSError('Google Apps Script email delivery failed.') from None
            sent += 1
        return sent
