import sys
from base58 import b58decode

key = b58decode(sys.argv[1])
print(list(bytes(key)))