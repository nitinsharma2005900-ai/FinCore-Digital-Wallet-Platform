import 'dotenv/config';
import {it,expect} from 'vitest';
import {requireSettledRefund,stripeMinorUnits} from '../../apps/api/src/providers';
it('keeps exact Stripe minor units and rejects excess precision',()=>{expect(stripeMinorUnits('0.01')).toBe(1);expect(stripeMinorUnits('12.34')).toBe(1234);expect(stripeMinorUnits('1')).toBe(100);for(const amount of ['0','-1','0.001'])expect(()=>stripeMinorUnits(amount)).toThrow();});
it('does not finalize pending, failed or canceled provider refunds',()=>{for(const status of ['pending','failed','canceled',null])expect(()=>requireSettledRefund({id:'synthetic_refund',status})).toThrow('not settled');expect(requireSettledRefund({id:'synthetic_refund',status:'succeeded'})).toBe('synthetic_refund');});
