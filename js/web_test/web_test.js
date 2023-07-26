let device;

const delay = (delayInms) => {
  return new Promise(resolve => setTimeout(resolve, delayInms));
}

async function sendReport(reportID, data)
{
  var dataOut1 = [reportID];
  var dataOut = new Uint8Array(dataOut1.concat(data));

  await device.transferOut(2, dataOut);
}

async function clickButton()
{
  // Request permission to access the gamepad
  device = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x057E, productId: 0x2009 }] });
  console.log(device);
  
  await device.open();
  await device.selectConfiguration(1);
  await device.claimInterface(1);

  console.log(device.productName);

  await sendReport(1, [0, 255, 0, 0]);
  await sendReport(1, [1, 0, 255, 0]);
};