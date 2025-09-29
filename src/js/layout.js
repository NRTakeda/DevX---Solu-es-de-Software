import headerHTML from '../components/header.html?raw';
import footerHTML from '../components/footer.html?raw';

export function initLayout() {
    const headerPlaceholder = document.getElementById('header-placeholder');
    const footerPlaceholder = document.getElementById('footer-placeholder');

    if (headerPlaceholder) {
        headerPlaceholder.outerHTML = headerHTML;
    }
    if (footerPlaceholder) {
        footerPlaceholder.outerHTML = footerHTML;
    }
}