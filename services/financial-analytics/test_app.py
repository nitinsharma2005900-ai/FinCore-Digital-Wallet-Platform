import os
import time
import json
from pathlib import Path
os.environ['INTERNAL_SERVICE_SECRET'] = 'test-internal-secret'
from fastapi.testclient import TestClient
from app import app
client = TestClient(app)
HEADERS = {'x-internal-secret': 'test-internal-secret'}
def post(path, body):
    return client.post(path, json=body, headers=HEADERS)

def test_health_and_authentication():
    assert client.get('/health').status_code == 200
    assert client.post('/fees', json={'amount': '1'}).status_code == 401

def test_half_even_boundaries():
    assert post('/fees', {'amount': '5', 'rate': '0.001'}).json()['fee'] == '0.00'
    assert post('/fees', {'amount': '15', 'rate': '0.001'}).json()['fee'] == '0.02'

def test_fee_cap_and_validation():
    assert post('/fees', {'amount': '100000', 'rate': '0.01'}).json()['fee'] == '50.00'
    for amount in ['-1', 'NaN', 'Infinity', 1.2]:
        assert post('/fees', {'amount': amount}).status_code == 422
    assert post('/fees', {'amount': '1', 'minimum': '10', 'maximum': '5'}).status_code == 422

def test_interest():
    assert post('/interest', {'principal': '1000', 'annualRate': '0.1', 'days': 365}).json()['interest'] == '100.00'
    assert post('/interest', {'principal': '1000', 'annualRate': '0.1', 'days': -1}).status_code == 422

def test_statement_totals():
    result = post('/statement', {'opening': '10.10', 'entries': [{'amount': '0.10', 'direction': 'DEBIT'}, {'amount': '20.20', 'direction': 'CREDIT'}]}).json()
    assert result['closingBalance'] == '30.20'
    assert result['debitTotal'] == '0.10'
    assert post('/statement', {'opening': '0', 'entries': []}).json()['count'] == 0

def test_reconciliation_classification():
    cases = [({'observed': '10'}, 'MATCHED'), ({}, 'MISSING'), ({'observed': '9'}, 'AMOUNT_MISMATCH'), ({'observed': '10', 'duplicateCount': 1}, 'DUPLICATE'), ({'observed': '10', 'failed': True}, 'FAILED_SETTLEMENT')]
    for fields, expected in cases:
        assert post('/reconcile', {'expected': '10', **fields}).json()['status'] == expected

def test_risk_patterns_and_boundaries():
    assert post('/risk', {'amount': '99999.99'}).json()['score'] == 0
    assert post('/risk', {'amount': '100000'}).json()['score'] == 40
    result = post('/risk', {'amount': '100000', 'transfersLastHour': 5, 'failedPaymentsLastHour': 3, 'beneficiariesLastHour': 3, 'transfersLastDay': 20}).json()
    assert result['score'] == 100 and len(result['reasons']) == 5
    assert post('/risk', {'amount': '1', 'transfersLastHour': -1}).status_code == 422

def test_measured_benchmark():
    start = time.perf_counter()
    for _ in range(200):
        assert post('/fees', {'amount': '1234.56'}).status_code == 200
        assert post('/risk', {'amount': '1234.56', 'transfersLastHour': 8}).status_code == 200
    elapsed = time.perf_counter() - start
    folder = Path(__file__).resolve().parents[2] / 'evidence'
    folder.mkdir(exist_ok=True)
    (folder / 'python-benchmark.json').write_text(json.dumps({'requests': 400, 'elapsedSeconds': elapsed, 'requestsPerSecond': 400 / elapsed, 'scope': 'in-process TestClient, not production capacity'}, indent=2))
