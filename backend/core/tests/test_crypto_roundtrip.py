from django.test import TestCase, override_settings

from core.crypto import decrypt, encrypt


@override_settings(DEBUG=True)
class CryptoRoundTripTests(TestCase):
    def test_encrypt_decrypt_roundtrip(self):
        plain = "s3cr3t!"
        token = encrypt(plain)
        self.assertTrue(token.startswith("enc::"))
        self.assertEqual(decrypt(token), plain)

    def test_decrypt_plaintext_passthrough(self):
        plain = "already-plain"
        self.assertEqual(decrypt(plain), plain)
