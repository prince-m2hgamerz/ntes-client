from ntes import NTESClient

client = NTESClient()
# print(client.search("rajdhani"))
print(client.live_status("02563", "15-Jun-2026"))
# print(client.trains_between("NDLS", "HWH"))