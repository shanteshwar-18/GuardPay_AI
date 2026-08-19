"""
GuardPay AI — Self-Signed mTLS Certificate Generator
Run once to generate certs for bank alert mTLS demo:
    python scripts/gen_certs.py
Outputs: certs/ca.crt, certs/server.crt/.key, certs/client.crt/.key
"""

from pathlib import Path
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import datetime

CERTS_DIR = Path("certs")
CERTS_DIR.mkdir(exist_ok=True)


def _gen_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _save_key(key, path: Path, password=None):
    enc = (serialization.BestAvailableEncryption(password)
           if password else serialization.NoEncryption())
    path.write_bytes(key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        enc,
    ))


def _save_cert(cert, path: Path):
    path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))


def _build_cert(subject_name, issuer_name, issuer_key, subject_key, is_ca=False):
    now = datetime.datetime.utcnow()
    builder = (
        x509.CertificateBuilder()
        .subject_name(subject_name)
        .issuer_name(issuer_name)
        .public_key(subject_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + datetime.timedelta(days=365))
    )
    if is_ca:
        builder = builder.add_extension(
            x509.BasicConstraints(ca=True, path_length=None), critical=True
        )
    return builder.sign(issuer_key, hashes.SHA256())


def main():
    print("Generating self-signed mTLS certs for GuardPay AI demo...")

    # CA
    ca_key = _gen_key()
    ca_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "GuardPay-CA")])
    ca_cert = _build_cert(ca_name, ca_name, ca_key, ca_key, is_ca=True)
    _save_key(ca_key, CERTS_DIR / "ca.key")
    _save_cert(ca_cert, CERTS_DIR / "ca.crt")

    # Server cert
    server_key = _gen_key()
    server_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    server_cert = _build_cert(server_name, ca_name, ca_key, server_key)
    _save_key(server_key, CERTS_DIR / "server.key")
    _save_cert(server_cert, CERTS_DIR / "server.crt")

    # Client cert (GuardPay backend → bank)
    client_key = _gen_key()
    client_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "guardpay-backend")])
    client_cert = _build_cert(client_name, ca_name, ca_key, client_key)
    _save_key(client_key, CERTS_DIR / "client.key")
    _save_cert(client_cert, CERTS_DIR / "client.crt")

    print(f"Certs written to {CERTS_DIR.absolute()}")
    print("  ca.crt, ca.key")
    print("  server.crt, server.key")
    print("  client.crt, client.key")


if __name__ == "__main__":
    main()
