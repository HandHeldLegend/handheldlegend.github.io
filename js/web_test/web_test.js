// Define the function to read input reports from the gamepad
const readInputReport = device => {
  // Define the endpoint for input reports
  const endpointNumber = 1; // Assumes the gamepad has a single interrupt IN endpoint
  const reportSize = 8; // Assumes the gamepad reports are 8 bytes long
  
  // Define a recursive function to read input reports
  const readReport = () => {
    device.transferIn(endpointNumber, reportSize)
      .then(result => {
        // Process the input report
        const report = new Uint8Array(result.data.buffer);
        console.log(`Received input report: ${report}`);
        
        // Call the function recursively to keep reading input reports
        readReport();
      })
      .catch(error => {
        console.error(error);
      });
  };
  
  // Call the function to start reading input reports
  readReport();
};

// Add an event listener to the Connect button
const connectButton = document.getElementById('connectButton');
connectButton.addEventListener('click', () => {
  // Request permission to access the gamepad
  navigator.usb.requestDevice({ filters: [{ vendorId: 0x20D6, productId: 0xA714 }] })
    .then(device => {
      // Open a connection to the gamepad
      return device.open();
    })
    .then(device => {
      // Select a configuration on the gamepad
      const configurationValue = 1;
      return device.selectConfiguration(configurationValue);
    })
    .then(() => {
      // Claim an interface on the gamepad
      const interfaceNumber = 0;
      return device.claimInterface(interfaceNumber);
    })
    .then(() => {
      // Call the function to start reading input reports
      readInputReport(device);
    })
    .catch(error => {
      console.error(error);
    });
});