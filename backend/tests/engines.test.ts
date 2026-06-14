import { splitExpenseAmount } from '../src/services/balanceEngine';
import { generateMinimalSettlements } from '../src/services/settlementEngine';
import { SplitType } from '../src/types/prismaEmulated';

describe('Shared Expenses App - Core Mathematical Engines', () => {
  
  describe('Balance Split Engine', () => {
    
    test('should divide equal splits correctly with decimal rounding adjustments', () => {
      const amount = 100;
      const participants = [
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ];
      
      const shares = splitExpenseAmount(amount, SplitType.EQUAL, participants);
      
      expect(shares).toHaveLength(3);
      expect(shares[0].amount).toBe(33.33);
      expect(shares[1].amount).toBe(33.33);
      expect(shares[2].amount).toBe(33.34); // final rounding adjustment
      
      const totalSum = shares.reduce((s, p) => s + p.amount, 0);
      expect(totalSum).toBe(100);
    });

    test('should allocate exact split amounts exactly as input', () => {
      const amount = 1500;
      const participants = [
        { userId: 'user-1', value: 800 },
        { userId: 'user-2', value: 700 },
      ];

      const shares = splitExpenseAmount(amount, SplitType.EXACT, participants);

      expect(shares[0].amount).toBe(800);
      expect(shares[1].amount).toBe(700);
    });

    test('should calculate percentage shares accurately', () => {
      const amount = 3000;
      const participants = [
        { userId: 'user-1', value: 50 },
        { userId: 'user-2', value: 25 },
        { userId: 'user-3', value: 25 },
      ];

      const shares = splitExpenseAmount(amount, SplitType.PERCENTAGE, participants);

      expect(shares[0].amount).toBe(1500);
      expect(shares[0].percentage).toBe(50);
      expect(shares[1].amount).toBe(750);
      expect(shares[1].percentage).toBe(25);
      expect(shares[2].amount).toBe(750);
      expect(shares[2].percentage).toBe(25);
      
      const totalSum = shares.reduce((s, p) => s + p.amount, 0);
      expect(totalSum).toBe(3000);
    });

    test('should calculate weighted shares correctly', () => {
      const amount = 6000;
      const participants = [
        { userId: 'user-1', value: 3 }, // weight 3
        { userId: 'user-2', value: 2 }, // weight 2
        { userId: 'user-3', value: 1 }, // weight 1
      ];

      const shares = splitExpenseAmount(amount, SplitType.WEIGHTED, participants);

      expect(shares[0].amount).toBe(3000); // 3/6
      expect(shares[0].weight).toBe(3);
      expect(shares[1].amount).toBe(2000); // 2/6
      expect(shares[1].weight).toBe(2);
      expect(shares[2].amount).toBe(1000); // 1/6
      expect(shares[2].weight).toBe(1);
    });

  });

  describe('Settlement Engine Solver', () => {

    test('should minimize N-to-N debts into minimal transfer Suggestions', () => {
      // Net balances where:
      // Aisha is owed: +₹1,200
      // Rohan owes: -₹800
      // Priya owes: -₹400
      const balances = [
        { userId: 'aisha-id', name: 'Aisha', net: 1200 },
        { userId: 'rohan-id', name: 'Rohan', net: -800 },
        { userId: 'priya-id', name: 'Priya', net: -400 },
      ];

      const suggestions = generateMinimalSettlements(balances);

      expect(suggestions).toHaveLength(2);
      
      // Rohan pays Aisha 800
      expect(suggestions[0]).toEqual({
        fromUserId: 'rohan-id',
        fromUserName: 'Rohan',
        toUserId: 'aisha-id',
        toUserName: 'Aisha',
        amount: 800,
        currency: 'INR',
      });

      // Priya pays Aisha 400
      expect(suggestions[1]).toEqual({
        fromUserId: 'priya-id',
        fromUserName: 'Priya',
        toUserId: 'aisha-id',
        toUserName: 'Aisha',
        amount: 400,
        currency: 'INR',
      });
    });

    test('should return empty suggestions when all balances are settled', () => {
      const balances = [
        { userId: 'aisha-id', name: 'Aisha', net: 0 },
        { userId: 'rohan-id', name: 'Rohan', net: 0 },
      ];

      const suggestions = generateMinimalSettlements(balances);
      expect(suggestions).toHaveLength(0);
    });

  });

});
