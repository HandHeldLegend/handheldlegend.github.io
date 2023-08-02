var eng_strings = {
    title: 'ProGCC Firmware Configurator',
    install: 'Install App',
    connect: 'Connect',
    disconnect: 'Disconnect',
    save: 'Save',
    reset: 'Reset',
    social: 'Social Media',
    colorTitle: 'Color Settings',
    copy: 'Copy',
    paste: 'Paste',
    snapbackTitle: 'Snapback Settings',
    calibrateTitle: 'Analog Calibration',
    calibrateDesc: "To calibrate your sticks, ensure both sticks are fully centered, then press start. Slowly rotate both sticks fully 4-5 times. The controller LEDs will turn blue when enough data has been captured to facilitate proper calibration. Press 'Stop' to complete calibration. If you are satisfied with the results, press 'Save'.",
    start: 'Start',
    stop: 'Stop',
    octagonTitle: 'Octacon Calibration',
    octagonDesc: 'To calibrate your controller for an octagon gate, move your analog stick to one of the octagon corners, then press the button below to update the angle. Press save when you are happy with the results.',
    update: 'Update',
    remapTitle: 'Remapping',
    remapDesc: 'To remap a button, click one of the button icons. Next, press the desired button on your ProGCC.',
    remapDesc2: "Click 'Save' when you are happy with the results.",
};

var jp_strings = {
    title: 'ProGCCファームウェア設定',
    install: 'アプリをインストール',
    connect: '接続',
    disconnect: '切断',
    save: '保存',
    reset: 'リセット',
    social: 'ソーシャルメディア',
    colorTitle: 'カラー設定',
    copy: 'コピー',
    paste: '貼り付け',
    snapbackTitle: 'スナップバック設定',
    calibrateTitle: 'アナログ校正',
    calibrateDesc: "スティックを校正するには、両方のスティックが完全に中心にあることを確認し、スタートを押します。ゆっくりと両方のスティックを4-5回完全に回転させます。コントローラーのLEDが青くなると、適切な校正を実施するための十分なデータがキャプチャされたことを示します。'停止'を押して校正を完了します。結果に満足したら、'保存'を押します。",
    start: 'スタート',
    stop: '停止',
    octagonTitle: 'オクタゴン校正',
    octagonDesc: 'オクタゴンゲート用にコントローラーを校正するには、アナログスティックをオクタゴンの角に移動し、次に下のボタンを押して角度を更新します。結果に満足したら、保存を押します。',
    update: '更新',
    remapTitle: 'リマッピング',
    remapDesc: 'ボタンをリマップするには、ボタンアイコンの1つをクリックします。次に、ProGCCで目的のボタンを押します。',
    remapDesc2: "結果に満足したら、'保存'をクリックします。",
};

let en_radio = document.getElementById("lang_en");
let jp_radio = document.getElementById("lang_jp");

function replacePlaceholders(element, placeholders) {
    const keys = Object.keys(placeholders);
    let textContent = element.innerHTML;
    for (let i = 0; i < keys.length; i++) {
        const placeholder = '{' + keys[i] + '}';
        const value = placeholders[keys[i]];
        const regex = new RegExp(placeholder, 'g');
        textContent = textContent.replace(regex, value);
    }
    element.innerHTML = textContent;
}

// replace placeholders in body element
//replacePlaceholders(document.body, eng_strings);



function changeLang(lang) {
    if (lang) {
        window.location.href = '#jp';
        location.reload();
    }
    else {
        window.location.href = '#en';
        location.reload();
    }
}

function timeZone() {
    var timezoneOffset = new Date().getTimezoneOffset();
    if (timezoneOffset > 0) {
        return 1; // JP
    } else {
        return 0; // EN
    }
}

// Function to get strings based on URL hash
function getStringsByURLHash() {
    var hash = window.location.hash;
    if (hash === '#jp') {
        langButton.setAttribute('onclick', 'changeLang(0)');
        langButton.innerHTML = "EN";
        replacePlaceholders(document.body, jp_strings);
    } else if (hash === '#en') {
        replacePlaceholders(document.body, eng_strings);
    }
    else if (timeZone()) {
        langButton.setAttribute('onclick', 'changeLang(0)');
        langButton.innerHTML = "EN";
        replacePlaceholders(document.body, jp_strings);
    }
    else
    {
        replacePlaceholders(document.body, eng_strings);
    }
}

let langButton = document.getElementById("langButton");
getStringsByURLHash();