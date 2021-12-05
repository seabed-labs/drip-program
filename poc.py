import random
import string

random.seed(1)
letters = string.ascii_lowercase

# b quoted against a
prices= [random.uniform(0.1, 10.0) for _ in range(1000)]

class User:
    address = ""
    a_balance = 0
    b_balance = 0
    def __init__(self) -> None:
        self.address = ''.join(random.choice(letters) for i in range(10))
        self.a_balance = random.choice([10,20,30,40,50])

class Vault:
    a_balance =0
    b_balance=0

    twap={0:0}
    last_dca_period=0

    drip_amount = 0
    dar={0:0}
    
    # address -> start_period, dca_periods, deposited_a, withdrawn_b
    position = {}
    
    def deposit(self, user: User, deposit_a, periods):
        self.__update_position_deposit(user, deposit_a, periods)
        self.a_balance = deposit_a
        drip = deposit_a/ periods
        self.drip_amount += drip
        self.dar[self.last_dca_period + periods] = drip
    
    def dca(self):
        i = self.last_dca_period + 1
        price = self.__swap_a_for_b(i)
        if price <=0 :
            raise Exception("can't swap a for b")
        self.twap[i] = (self.twap[i-1]*(i-1)+price)/i
        self.last_dca_period = i
        self.drip_amount -= self.dar[i]

    def __update_position_deposit(self, user: User, deposit_a, periods):
        if deposit_a > user.a_balance:
            raise Exception('cannot deposit more then owned')
        if user.address in self.position:
            raise Exception('cannot deposit more then once')
        user.a_balance -= deposit_a
        self.position[user.address] = {
            "start_period": self.last_dca_period + 1,
            "dca_periods": periods,
            "deposited_a": deposit_a,
            "withdrawn_b": 0,
        }

    def __swap_a_for_b(self, period) -> float:
        if self.a_balance <= 0 or prices[period] <= 0:
            return 0
        price = prices[period]
        self.b_balance = price * self.drip_amount
        self.a_balance -= self.drip_amount
        return price


def dca(vault, periods):
    for i in range(periods):
        vault.dca()
    print(f"vault balance after period {vault.last_dca_period} ".ljust(40) + f"a:{round(vault.a_balance, 10)}".ljust(20) + f"b:{round(vault.b_balance, 10)}".ljust(20))
    
user1 = User()
user2 = User()
vault = Vault()
print(f"user1 balance ".ljust(40) + f"a:{round(user1.a_balance,10)}".ljust(20) + f"b:{round(user1.b_balance,10)}".ljust(20))
print(f"user2 balance ".ljust(40) + f"a:{round(user2.a_balance,10)}".ljust(20) + f"b:{round(user2.b_balance,10)}".ljust(20))

vault.deposit(user1, user1.a_balance, 11)
print(f"user1 balance after deposit ".ljust(40) + f"a:{round(user1.a_balance,10)}".ljust(20) + f"b:{round(user1.b_balance,10)}".ljust(20))
print(f"vault balance after user1 deposit ".ljust(40) + f"a:{round(vault.a_balance,10)}".ljust(20) + f"b:{round(vault.b_balance,10)}".ljust(20))

dca(vault, 5)

vault.deposit(user2, user2.a_balance/2, 13)
print(f"user2 balance after deposit ".ljust(40) + f"a:{round(user2.a_balance, 10)}".ljust(20) + f"b:{round(user2.b_balance,10)}".ljust(20))

dca(vault, 6)
dca(vault, 4)
dca(vault, 5)

