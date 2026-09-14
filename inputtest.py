from evdev import InputDevice, categorize, ecodes

device = InputDevice('/dev/input/by-id/usb-04d9_USB_Keyboard-event-kbd')

print(device)

for event in device.read_loop():
    if event.type == ecodes.EV_KEY:
        print(categorize(event))