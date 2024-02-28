let _offlineIndicatorElement = document.getElementById("offline-indicator");
var _offline = false;

function offline_indicator_enable(enable) {
    if (enable) {
        _offline = true;
        _offlineIndicatorElement.removeAttribute('disabled');
    }
    else 
    {
        _offlineIndicatorElement.setAttribute('disabled', 'true');
        _offline = false;
    }
}

function network_is_available()
{
    return !_offline;
}

function isOnline() {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://api.github.com/', true);
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            console.log("Network Online.");
            offline_indicator_enable(false);
            resolve(true); // Online
          } else {
            console.log("Network Offline.");
            offline_indicator_enable(true);
            resolve(false); // Offline
          }
        }
      };
      xhr.onerror = () => {
        resolve(false); // Offline
      };
      xhr.send();
    });
  }

isOnline();