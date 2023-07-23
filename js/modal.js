/**
 * while modals are entirely css-driven, this progressive JS is used to prevent the body from scrolling while in the modal
 */

document.querySelectorAll('.modal-toggle').forEach(toggle => {
    toggle.addEventListener('click', e => {
        if (e.target.checked) {
            document.body.classList.add('modal-open')
        } else {
            document.body.classList.remove('modal-open')
        }
    })
})