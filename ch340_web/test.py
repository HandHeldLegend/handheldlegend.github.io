import serial

def set_dtr_rts(ser, dtr_rts_state):
    """Set DTR and RTS based on a binary input string like '11', '01', etc."""
    dtr = dtr_rts_state[0] == '1'
    rts = dtr_rts_state[1] == '1'
    ser.dtr = dtr
    ser.rts = rts
    print(f"DTR {'enabled' if dtr else 'disabled'}, RTS {'enabled' if rts else 'disabled'}")

def test_dtr_rts(com_port):
    # Open the serial port
    with serial.Serial(com_port, 9600, timeout=1) as ser:
        print(f"Testing DTR and RTS on {com_port}")

        while True:
            dtr_rts_state = input("Enter DTR and RTS state (11, 10, 01, 00) or 'q' to quit: ")
            if dtr_rts_state.lower() == 'q':
                print("Exiting...")
                break
            elif dtr_rts_state in ['11', '10', '01', '00']:
                set_dtr_rts(ser, dtr_rts_state)
            else:
                print("Invalid input, please enter '11', '10', '01', '00' or 'q' to quit.")

if __name__ == "__main__":
    # Replace 'COM1' with the correct COM port number
    test_dtr_rts('COM256')
