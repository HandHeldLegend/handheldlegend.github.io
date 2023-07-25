let device;

async function clickButton()
{
  // Request permission to access the gamepad
  device = await navigator.hid.requestDevice({ filters: [{ vendorId: 0x057E, productId: 0x2009 }] });
  console.log(device);
  await device[0].open();

  document.getElementById("text_test").innerHTML = device[0].productName;

  console.log(device);
};