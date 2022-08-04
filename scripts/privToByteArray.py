import sys
from base58 import b58encode

key = b58encode(bytearray([]))
print(key)
print(list(bytes(key)))