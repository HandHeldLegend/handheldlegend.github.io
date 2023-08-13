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
    snapbackTitle: 'Snapback Viewer',
    snapbackDesc: 'Enjoy zero snapback :)',
    calibrateTitle: 'Analog Calibration',
    calibrateDesc: "To calibrate your sticks, ensure both sticks are fully centered, then press start. Slowly rotate both sticks fully 4-5 times. The controller LEDs will turn blue when enough data has been captured to facilitate proper calibration. Press 'Stop' to complete calibration. If you are satisfied with the results, press 'Save'.",
    start: 'Start',
    stop: 'Stop',
    octagonTitle: 'Octagon Calibration',
    octagonDesc: 'To calibrate your controller for an octagon gate, move your analog stick to one of the octagon corners, then press the button below to update the angle. Press save when you are happy with the results.',
    update: 'Update',
    remapTitle: 'Remapping',
    remapDesc: 'To remap a button, click one of the button icons. Next, press the desired button on your ProGCC.',
    remapDesc2: "Click 'Save' when you are happy with the results.",
    fwMsg1: 'Your device is out of date!',
    fwMsg2: 'Click the button below to reset your controller to FW update mode.',
    fwInstall: 'Next, click the button below to download the latest firmware. Copy the .uf2 file to the RPI-RP2 device shown in your file manager. Be sure to recalibrate after updating!',
    download: 'Download',
    bootloader: 'Bootloader',
    gamecubeTitle: 'GameCube SP Function',
    gamecubeDesc: 'Select the function for SP mapping.',
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
    snapbackTitle: '反動',
    snapbackDesc: '楽しむ',
    calibrateTitle: 'アナログスティックの調整',
    calibrateDesc: "スティックを調整するには、両方のスティックが完全に中央にあることを確認し、スタートを押します。両方のスティックをゆっくりと4～5回ほど回転させます。適切な調整を行うのに十分なデータが取得されると、コントローラのLEDが青色に点灯します。'停止'を押して調整を完了します。調整が完了して問題がなければ'保存'を押してください。",
    start: 'スタート',
    stop: '停止',
    octagonTitle: '八角ガイドの調整',
    octagonDesc: "八角ガイドシェル用にスティックを調整するには、アナログスティックを八角形の角の1つにスティックを傾け、下の'更新'を押して角度を更新します。調整が完了して問題がなければ'保存'を押してください。",
    update: '更新',
    remapTitle: 'リマッピング',
    remapDesc: 'ボタンをリマップするには、ボタンアイコンの1つをクリックします。次に、ProGCCで目的のボタンを押します。',
    remapDesc2: "結果に満足したら、'保存'をクリックします。",
    fwMsg1: 'あなたのデバイスは古いです！',
    fwMsg2: '下のボタンをクリックして、コントローラーをFWアップデートモードにリセットしてください。',
    fwInstall: '次に、下のボタンをクリックして最新のファームウェアをダウンロードしてください。.uf2ファイルをファイルマネージャーに表示されたRPI-RP2デバイスにコピーしてください。',
    download: 'ダウンロード',
    bootloader: 'ブートローダー',
    gamecubeTitle: 'ゲームキューブSP機能',
    gamecubeDesc: 'SPマッピングの機能を選択してください。',
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
    else if (!timeZone()) {
        console.log("Time zone is JP");
        langButton.setAttribute('onclick', 'changeLang(0)');
        langButton.innerHTML = "EN";
        replacePlaceholders(document.body, jp_strings);
    }
    else {
        console.log("Time zone is EN");
        replacePlaceholders(document.body, eng_strings);
    }
}

let langButton = document.getElementById("langButton");
getStringsByURLHash();