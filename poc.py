import random
import string
from collections import defaultdict

random.seed(1)
letters = string.ascii_lowercase

# b quoted against a
prices = [random.uniform(0.1, 10.0) for _ in range(1000)]

prices = [2 for _ in range(1000)]

class User:
    address = ""
    a_balance = 0
    b_balance = 0
    def __init__(self,balance, address) -> None:
        self.address = ''.join(random.choice(letters) for i in range(5))
        if address is not None:
            self.address = address
        self.a_balance = random.choice([10,20,30,40,50])
        if balance is not None:
            self.a_balance  = balance
    def print(self):
        print(f"user {self.address} balance".ljust(40) + f"a:{round(self.a_balance,10)}".ljust(20) + f"b:{round(self.b_balance,10)}".ljust(20))
       
# Position is an NFT/Account something the vault can mint
class Position:
    # The first period in which this position accumulates asset B
    start_period = 0
    # Users can withdraw assets accumulated from period [last_withdrawn_period+1, expiry_period]
    last_withdrawn_period = 0
    # Position is done accumulating asset B when vault.last_dca_period == position.expiry_period
    expiry_period = 0
    # How many periods this position will accumulate assets
    periods = 0
    a_deposited = 0
    # We don't technically need this.
    # It provides convineice but also adds more complexity 
    is_done = False
    vault = ""
    authority = ""
    def __init__(self, vault, authority, start_period, periods, a_deposit ):
        self.vault = vault
        self.authority = authority
        self.start_period = start_period
        self.last_withdrawn_period = start_period-1
        self.expiry_period = start_period - 1 + periods
        self.periods = periods
        self.a_deposited = a_deposit


class Vault:
    address = ""
    a_balance = 0
    b_balance = 0

    twap = defaultdict(lambda: 0)
    last_dca_period = 0

    drip_amount = 0
    drip_amount_reduction = defaultdict(lambda: 0)
    
    positions = {}

    def print(self):
        print(f"vault balance at period {self.last_dca_period} ".ljust(40) + f"a:{round(self.a_balance, 10)}".ljust(20) + f"b:{round(self.b_balance, 10)}".ljust(20))

    def deposit(self, user: User, deposit_a, periods):
        self.address = ''.join(random.choice(letters) for i in range(10))
        self.__update_position_deposit(user, deposit_a, periods)
        self.a_balance += deposit_a
        drip = deposit_a / periods
        self.drip_amount += drip
        self.drip_amount_reduction[self.last_dca_period + periods] += drip
        user.print()
        self.print()


    def withdraw_b(self, user:User, amount):
        if user.address not in self.positions:
            raise Exception('no position to withdraw from')
        pos: Position = self.positions[user.address]
        if pos.is_done:
            print("position is done")
            return
        j,i = min(self.last_dca_period, pos.expiry_period), pos.last_withdrawn_period
        if j <= i: 
            raise Exception("can't withdraw same period as deposit")
        drip_per_period = (pos.a_deposited) / pos.periods
        a_dripped_since_last_withdraw = drip_per_period * (j-i)
        average_price_since_last_withdraw = (self.twap[j]*(j) - self.twap[i]*(i))/(j-i)
        if average_price_since_last_withdraw <= 0:
            average_price_since_last_withdraw = 0
        withdrawable_b = average_price_since_last_withdraw * a_dripped_since_last_withdraw
        if amount is None:
            amount = withdrawable_b
        if (withdrawable_b <= 0 or withdrawable_b == amount) and self.last_dca_period >= pos.expiry_period:
            pos.is_done = True
        if amount > withdrawable_b:
            raise Exception("requesting more then withdrawable_b")
        self.b_balance -= withdrawable_b
        user.b_balance += withdrawable_b
        pos.last_withdrawn_period = self.last_dca_period
        self.positions[user.address] = pos
        user.print()
        self.print()
        print("[DEBUG] withdraw summary", drip_per_period, a_dripped_since_last_withdraw, average_price_since_last_withdraw, withdrawable_b, pos.is_done)

    def dca(self):
        i = self.last_dca_period + 1
        price = self.__swap_a_for_b(i)
        self.twap[i] = (self.twap[i-1]*(i-1)+price)/i
        self.last_dca_period = i
        self.drip_amount -= self.drip_amount_reduction[i]
        self.print()

    def __update_position_deposit(self, user: User, deposit_a, periods):
        if deposit_a > user.a_balance:
            raise Exception('cannot deposit more then owned')
        if user.address in self.positions:
            raise Exception('cannot deposit more then once')
        user.a_balance -= deposit_a
        self.positions[user.address] = Position(self.address, user.address, self.last_dca_period+1, periods, deposit_a)

    def __swap_a_for_b(self, period) -> float:
        if self.a_balance <= 0 or prices[period] <= 0:
            return 0
        price = prices[period]
        self.b_balance += price * self.drip_amount
        self.a_balance -= self.drip_amount
        return price



vault = Vault()

def dca(vault, periods):
    for _ in range(periods):
        vault.dca()


user1 = User(25, "1")
vault.deposit(user1, 25, 5)
dca(vault, 5)
vault.withdraw_b(user1, None)

user2 = User(15, "2")
vault.deposit(user2, 10, 5)
dca(vault, 5)
vault.withdraw_b(user2, None)
vault.withdraw_b(user2, None)
vault.withdraw_b(user2, None)


user3 = User(50, "3")
user4 = User(37.5, "4")
vault.deposit(user3, 10, 10)
vault.deposit(user4, 24.9, 30)
dca(vault, 5)
vault.withdraw_b(user4, None)
dca(vault, 5)
vault.withdraw_b(user3, None)
dca(vault, 10)
vault.withdraw_b(user4, None)
dca(vault, 10)
vault.withdraw_b(user4, None)
dca(vault, 10)
vault.withdraw_b(user4, None)
