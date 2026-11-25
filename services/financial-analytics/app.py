"""Stateless Decimal calculations and transparent risk rules; Express owns all records."""
import hmac
import os
from decimal import Decimal, ROUND_HALF_EVEN, InvalidOperation
from typing import Annotated, Literal
from fastapi import FastAPI, Header, HTTPException, Depends
from pydantic import BaseModel, Field, BeforeValidator

def exact(value):
    if not isinstance(value, str):
        raise ValueError('Decimal inputs must be JSON strings')
    try:
        result = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError('Must be a valid decimal string') from exc
    if not result.is_finite():
        raise ValueError('Must be finite')
    return result

Money = Annotated[Decimal, BeforeValidator(exact), Field(ge=0, le=Decimal('100000000000000000'))]
Rate = Annotated[Decimal, BeforeValidator(exact), Field(ge=0, le=1)]
CENT = Decimal('0.01')
def rounded(value: Decimal) -> str:
    return format(value.quantize(CENT, rounding=ROUND_HALF_EVEN), '.2f')

def internal(x_internal_secret: str = Header(default='')):
    expected = os.getenv('INTERNAL_SERVICE_SECRET', '')
    if not expected or not hmac.compare_digest(x_internal_secret, expected):
        raise HTTPException(401, 'Internal authentication required')

app = FastAPI(title='FinCore Financial Analytics', version='1.0.0', description='Synthetic data only. Risk scores support decisions; they are not proof of fraud.')

@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'financial-analytics', 'rounding': 'ROUND_HALF_EVEN', 'currency': 'INR'}

class FeeInput(BaseModel):
    amount: Money
    rate: Rate = Decimal('0.001')
    minimum: Money = Decimal('0.00')
    maximum: Money = Decimal('50.00')

@app.post('/fees', dependencies=[Depends(internal)])
def fees(body: FeeInput):
    if body.minimum > body.maximum:
        raise HTTPException(422, 'Minimum exceeds maximum')
    fee = min(body.maximum, max(body.minimum, body.amount * body.rate))
    return {'fee': rounded(fee), 'total': rounded(body.amount + fee), 'currency': 'INR', 'rounding': 'ROUND_HALF_EVEN'}

class InterestInput(BaseModel):
    principal: Money
    annualRate: Rate
    days: int = Field(ge=0, le=36600)

@app.post('/interest', dependencies=[Depends(internal)])
def interest(body: InterestInput):
    result = body.principal * body.annualRate * Decimal(body.days) / Decimal(365)
    return {'interest': rounded(result), 'closingBalance': rounded(body.principal + result), 'basis': 'ACT/365 simple interest'}

class Entry(BaseModel):
    amount: Money
    direction: Literal['DEBIT', 'CREDIT']

class StatementInput(BaseModel):
    opening: Annotated[Decimal, BeforeValidator(exact)] = Decimal(0)
    entries: list[Entry] = Field(max_length=100000)

@app.post('/statement', dependencies=[Depends(internal)])
def statement(body: StatementInput):
    debit = sum((e.amount for e in body.entries if e.direction == 'DEBIT'), Decimal(0))
    credit = sum((e.amount for e in body.entries if e.direction == 'CREDIT'), Decimal(0))
    return {'openingBalance': rounded(body.opening), 'debitTotal': rounded(debit), 'creditTotal': rounded(credit), 'closingBalance': rounded(body.opening + credit - debit), 'count': len(body.entries)}

class ReconcileInput(BaseModel):
    expected: Money
    observed: Money | None = None
    duplicateCount: int = Field(default=0, ge=0)
    failed: bool = False

@app.post('/reconcile', dependencies=[Depends(internal)])
def reconcile(body: ReconcileInput):
    status = 'FAILED_SETTLEMENT' if body.failed else 'MISSING' if body.observed is None else 'AMOUNT_MISMATCH' if body.expected != body.observed else 'DUPLICATE' if body.duplicateCount > 0 else 'MATCHED'
    return {'status': status, 'difference': rounded(body.expected - (body.observed or Decimal(0)))}

class RiskInput(BaseModel):
    amount: Money
    transfersLastHour: int = Field(default=0, ge=0, le=1000000)
    failedPaymentsLastHour: int = Field(default=0, ge=0, le=1000000)
    beneficiariesLastHour: int = Field(default=0, ge=0, le=1000000)
    transfersLastDay: int = Field(default=0, ge=0, le=1000000)

@app.post('/risk', dependencies=[Depends(internal)])
def risk(body: RiskInput):
    reasons = []
    score = 0
    rules = [
        (body.amount >= Decimal('100000'), 40, 'LARGE_TRANSFER', 'Transfer is at least INR 100,000'),
        (body.transfersLastHour >= 5, 30, 'HIGH_VELOCITY', 'At least five transfers in the past hour'),
        (body.failedPaymentsLastHour >= 3, 25, 'FAILED_PAYMENTS', 'At least three recent failed payment attempts'),
        (body.beneficiariesLastHour >= 3, 20, 'RAPID_BENEFICIARIES', 'At least three beneficiaries added in one hour'),
        (body.transfersLastDay >= 20, 20, 'UNUSUAL_FREQUENCY', 'At least twenty transfers in one day'),
    ]
    for applies, weight, code, explanation in rules:
        if applies:
            score += weight
            reasons.append({'code': code, 'explanation': explanation})
    score = min(score, 100)
    return {'score': score, 'level': 'HIGH' if score >= 60 else 'MEDIUM' if score >= 30 else 'LOW', 'reasons': reasons, 'notice': 'Decision support only; not proof of fraud.'}
