let device;

// Add an event listener to the Connect button
const connectButton = document.getElementById('connectButton');
async function clickButton()
{
  // Request permission to access the gamepad
  device = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x057E, productId: 0x2009 }] });

  await device.open();
  await device.selectConfiguration(1);
  await device.claimInterface(0);
};