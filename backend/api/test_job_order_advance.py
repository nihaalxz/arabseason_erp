import json
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from api.models import (
    Customer, JobOrder, CustomerPayment, CashBookEntry,
    BankAccount, PettyCashAccount, RecycleBinItem
)

class JobOrderAdvanceIntegrationTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_superuser(
            username='admin_test',
            email='admin@test.com',
            password='password123',
            role='Admin'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.customer = Customer.objects.create(name='Test Customer Advance', phone='0500000000')

        self.bank_a = BankAccount.objects.create(
            bank_name='Bank A',
            account_number='SA1111111111',
            balance=Decimal('1000.00'),
            status='Active'
        )
        self.bank_b = BankAccount.objects.create(
            bank_name='Bank B',
            account_number='SA2222222222',
            balance=Decimal('2000.00'),
            status='Active'
        )
        self.pca = PettyCashAccount.objects.create(
            name='Test Petty Cash',
            holder_name='Petty Cash Holder',
            balance=Decimal('500.00'),
            status='Active'
        )

    def test_create_with_bank_and_with_petty_cash(self):
        # 1. Create with Bank A
        res = self.client.post('/api/job-orders/', {
            'title': 'Job with Bank',
            'customer': self.customer.id,
            'total_amount': '1000.00',
            'advance_amount': '250.00',
            'bank_account': self.bank_a.id,
            'assigned_to': self.user.id
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        job_id = res.data['id']

        self.bank_a.refresh_from_db()
        self.assertEqual(self.bank_a.balance, Decimal('1250.00'))

        job = JobOrder.objects.get(id=job_id)
        self.assertEqual(job.payment_type, 'advance')
        cp = CustomerPayment.objects.filter(job_order=job, payment_type='advance')
        self.assertEqual(cp.count(), 1)
        self.assertEqual(cp.first().amount, Decimal('250.00'))

        cb = CashBookEntry.objects.filter(customer_payment=cp.first())
        self.assertEqual(cb.count(), 1)
        self.assertEqual(cb.first().amount, Decimal('250.00'))
        self.assertEqual(cb.first().bank_account, self.bank_a)

        # Check advance_payment_source serializer field
        self.assertIsNotNone(res.data.get('advance_payment_source'))
        self.assertEqual(res.data['advance_payment_source']['account_type'], 'bank')
        self.assertEqual(res.data['advance_payment_source']['account_id'], self.bank_a.id)

        # 2. Create with Petty Cash
        res2 = self.client.post('/api/job-orders/', {
            'title': 'Job with Petty Cash',
            'customer': self.customer.id,
            'total_amount': '800.00',
            'advance_amount': '300.00',
            'petty_cash_account': self.pca.id,
            'assigned_to': self.user.id
        }, format='json')
        self.assertEqual(res2.status_code, 201, res2.data)
        job2_id = res2.data['id']

        self.pca.refresh_from_db()
        self.assertEqual(self.pca.balance, Decimal('800.00')) # 500 + 300

        job2 = JobOrder.objects.get(id=job2_id)
        self.assertEqual(job2.payment_type, 'advance')
        cp2 = CustomerPayment.objects.filter(job_order=job2, payment_type='advance')
        self.assertEqual(cp2.count(), 1)
        self.assertEqual(cp2.first().amount, Decimal('300.00'))

        cb2 = CashBookEntry.objects.filter(customer_payment=cp2.first())
        self.assertEqual(cb2.count(), 1)
        self.assertEqual(cb2.first().petty_cash_account, self.pca)
        self.assertEqual(res2.data['advance_payment_source']['account_type'], 'petty_cash')
        self.assertEqual(res2.data['advance_payment_source']['account_id'], self.pca.id)

    def test_increase_and_decrease_advance(self):
        # Initial creation: advance 200 on Bank A (balance 1000 -> 1200)
        res = self.client.post('/api/job-orders/', {
            'title': 'Job Inc Dec',
            'customer': self.customer.id,
            'total_amount': '1000.00',
            'advance_amount': '200.00',
            'bank_account': self.bank_a.id,
            'assigned_to': self.user.id
        }, format='json')
        self.assertEqual(res.status_code, 201)
        job_id = res.data['id']

        self.bank_a.refresh_from_db()
        self.assertEqual(self.bank_a.balance, Decimal('1200.00'))

        # Increase advance to 350
        res_inc = self.client.patch(f'/api/job-orders/{job_id}/', {
            'advance_amount': '350.00',
            'bank_account': self.bank_a.id
        }, format='json')
        self.assertEqual(res_inc.status_code, 200, res_inc.data)

        self.bank_a.refresh_from_db()
        self.assertEqual(self.bank_a.balance, Decimal('1350.00'))
        cp = CustomerPayment.objects.filter(job_order_id=job_id, payment_type='advance')
        self.assertEqual(cp.count(), 1)
        self.assertEqual(cp.first().amount, Decimal('350.00'))
        cb = CashBookEntry.objects.filter(customer_payment=cp.first())
        self.assertEqual(cb.first().amount, Decimal('350.00'))

        # Decrease advance to 100
        res_dec = self.client.patch(f'/api/job-orders/{job_id}/', {
            'advance_amount': '100.00',
            'bank_account': self.bank_a.id
        }, format='json')
        self.assertEqual(res_dec.status_code, 200, res_dec.data)

        self.bank_a.refresh_from_db()
        self.assertEqual(self.bank_a.balance, Decimal('1100.00'))
        cp.first().refresh_from_db()
        self.assertEqual(cp.first().amount, Decimal('100.00'))
        cb.first().refresh_from_db()
        self.assertEqual(cb.first().amount, Decimal('100.00'))

    def test_switch_bank_to_petty_cash_and_bank_a_to_bank_b(self):
        # Initial creation: advance 200 on Bank A (balance: A=1200, B=2000, PCA=500)
        res = self.client.post('/api/job-orders/', {
            'title': 'Job Switch Account',
            'customer': self.customer.id,
            'total_amount': '1000.00',
            'advance_amount': '200.00',
            'bank_account': self.bank_a.id,
            'assigned_to': self.user.id
        }, format='json')
        self.assertEqual(res.status_code, 201)
        job_id = res.data['id']

        self.bank_a.refresh_from_db()
        self.assertEqual(self.bank_a.balance, Decimal('1200.00'))

        # Switch Bank A -> Petty Cash with amount change to 250
        res_switch1 = self.client.patch(f'/api/job-orders/{job_id}/', {
            'advance_amount': '250.00',
            'petty_cash_account': self.pca.id
        }, format='json')
        self.assertEqual(res_switch1.status_code, 200, res_switch1.data)

        self.bank_a.refresh_from_db()
        self.pca.refresh_from_db()
        # Bank A must be reversed by old amount 200 (1200 - 200 = 1000)
        self.assertEqual(self.bank_a.balance, Decimal('1000.00'))
        # PCA must be credited by new amount 250 (500 + 250 = 750)
        self.assertEqual(self.pca.balance, Decimal('750.00'))

        # Check only 1 advance payment exists
        cps = CustomerPayment.objects.filter(job_order_id=job_id, payment_type='advance')
        self.assertEqual(cps.count(), 1)
        self.assertEqual(cps.first().amount, Decimal('250.00'))
        cbs = CashBookEntry.objects.filter(customer_payment=cps.first())
        self.assertEqual(cbs.count(), 1)
        self.assertEqual(cbs.first().petty_cash_account, self.pca)
        self.assertIsNone(cbs.first().bank_account)

        # Switch PCA -> Bank B with same amount (250)
        res_switch2 = self.client.patch(f'/api/job-orders/{job_id}/', {
            'advance_amount': '250.00',
            'bank_account': self.bank_b.id
        }, format='json')
        self.assertEqual(res_switch2.status_code, 200, res_switch2.data)

        self.pca.refresh_from_db()
        self.bank_b.refresh_from_db()
        # PCA reversed by 250 (750 - 250 = 500)
        self.assertEqual(self.pca.balance, Decimal('500.00'))
        # Bank B credited by 250 (2000 + 250 = 2250)
        self.assertEqual(self.bank_b.balance, Decimal('2250.00'))

        cps = CustomerPayment.objects.filter(job_order_id=job_id, payment_type='advance')
        self.assertEqual(cps.count(), 1)
        cbs = CashBookEntry.objects.filter(customer_payment=cps.first())
        self.assertEqual(cbs.count(), 1)
        self.assertEqual(cbs.first().bank_account, self.bank_b)
        self.assertIsNone(cbs.first().petty_cash_account)

    def test_advance_set_to_zero_and_recycle_bin(self):
        # Initial creation: advance 200 on Bank A (balance: 1000 -> 1200)
        res = self.client.post('/api/job-orders/', {
            'title': 'Job Advance to 0',
            'customer': self.customer.id,
            'total_amount': '1000.00',
            'advance_amount': '200.00',
            'bank_account': self.bank_a.id,
            'assigned_to': self.user.id
        }, format='json')
        job_id = res.data['id']

        self.bank_a.refresh_from_db()
        self.assertEqual(self.bank_a.balance, Decimal('1200.00'))

        # Set advance to 0
        res_zero = self.client.patch(f'/api/job-orders/{job_id}/', {
            'advance_amount': '0.00'
        }, format='json')
        self.assertEqual(res_zero.status_code, 200, res_zero.data)

        # Bank A reversed
        self.bank_a.refresh_from_db()
        self.assertEqual(self.bank_a.balance, Decimal('1000.00'))

        # Payment and CashBookEntry deleted
        cps = CustomerPayment.objects.filter(job_order_id=job_id, payment_type='advance')
        self.assertEqual(cps.count(), 0)

        # Verified archived in RecycleBinItem
        bin_items = RecycleBinItem.objects.filter(entity_type='customer_payment')
        self.assertTrue(bin_items.exists())

        job = JobOrder.objects.get(id=job_id)
        self.assertEqual(job.payment_type, 'full')

    def test_patch_total_amount_only_has_no_side_effects(self):
        # Create job with advance 200 on Bank A (balance: 1000 -> 1200)
        res = self.client.post('/api/job-orders/', {
            'title': 'Job No Side Effects',
            'customer': self.customer.id,
            'total_amount': '1000.00',
            'advance_amount': '200.00',
            'bank_account': self.bank_a.id,
            'assigned_to': self.user.id
        }, format='json')
        job_id = res.data['id']

        self.bank_a.refresh_from_db()
        self.assertEqual(self.bank_a.balance, Decimal('1200.00'))

        # Send PATCH with ONLY total_amount
        res_patch = self.client.patch(f'/api/job-orders/{job_id}/', {
            'total_amount': '1500.00'
        }, format='json')
        self.assertEqual(res_patch.status_code, 200, res_patch.data)

        self.bank_a.refresh_from_db()
        # Balance must remain exactly 1200.00!
        self.assertEqual(self.bank_a.balance, Decimal('1200.00'))

        job = JobOrder.objects.get(id=job_id)
        self.assertEqual(job.total_amount, Decimal('1500.00'))
        self.assertEqual(job.advance_amount, Decimal('200.00'))
        self.assertEqual(job.payment_type, 'advance')

        cp = CustomerPayment.objects.filter(job_order=job, payment_type='advance').first()
        self.assertEqual(cp.amount, Decimal('200.00'))
        cb = CashBookEntry.objects.filter(customer_payment=cp).first()
        self.assertEqual(cb.amount, Decimal('200.00'))

    def test_legacy_job_edit_without_account(self):
        # Create legacy job directly in DB with advance_amount > 0 and CP, but NO CashBookEntry and NO account
        legacy_job = JobOrder.objects.create(
            order_id='LEGACY01',
            title='Legacy Job Order',
            customer=self.customer,
            total_amount=Decimal('800.00'),
            advance_amount=Decimal('150.00'),
            payment_type='advance',
            created_by=self.user
        )
        CustomerPayment.objects.create(
            customer=self.customer,
            job_order=legacy_job,
            amount=Decimal('150.00'),
            payment_date='2026-10-01',
            payment_type='advance',
            created_by=self.user
        )

        # Unrelated edit (e.g. title change) without passing account or advance
        res = self.client.patch(f'/api/job-orders/{legacy_job.id}/', {
            'title': 'Legacy Job Updated Title'
        }, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        legacy_job.refresh_from_db()
        self.assertEqual(legacy_job.title, 'Legacy Job Updated Title')
        self.assertEqual(legacy_job.advance_amount, Decimal('150.00'))

    def test_validation_advance_exceeds_total_and_negative(self):
        # 1. Advance > Total rejected on create
        res1 = self.client.post('/api/job-orders/', {
            'title': 'Job Invalid Advance',
            'customer': self.customer.id,
            'total_amount': '500.00',
            'advance_amount': '600.00',
            'bank_account': self.bank_a.id,
            'assigned_to': self.user.id
        }, format='json')
        self.assertEqual(res1.status_code, 400)
        self.assertIn('advance_amount', res1.data)

        # 2. Negative advance rejected on create
        res2 = self.client.post('/api/job-orders/', {
            'title': 'Job Negative Advance',
            'customer': self.customer.id,
            'total_amount': '500.00',
            'advance_amount': '-50.00',
            'bank_account': self.bank_a.id,
            'assigned_to': self.user.id
        }, format='json')
        self.assertEqual(res2.status_code, 400)
        self.assertIn('advance_amount', res2.data)

        # 3. Advance > Total rejected when total reduced below advance on PATCH
        res3 = self.client.post('/api/job-orders/', {
            'title': 'Job Valid First',
            'customer': self.customer.id,
            'total_amount': '500.00',
            'advance_amount': '300.00',
            'bank_account': self.bank_a.id,
            'assigned_to': self.user.id
        }, format='json')
        self.assertEqual(res3.status_code, 201)
        job_id = res3.data['id']

        res4 = self.client.patch(f'/api/job-orders/{job_id}/', {
            'total_amount': '200.00'
        }, format='json')
        self.assertEqual(res4.status_code, 400)
        self.assertIn('advance_amount', res4.data)

