let device;

// Add an event listener to the Connect button
const connectButton = document.getElementById('connectButton');
async function clickButton()
{
  addEventListener("connect", (event) => {
    console.log("Device connected.");
  });

  // Request permission to access the gamepad
  device = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x057E, productId: 0x2009 }] });

  await device.open();
  await device.claimInterface(0);

  console.log(device.productName);
  console.log(device.manufacturerName);
};