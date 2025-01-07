// tooltips.js
const tooltipStyles = `
<style>
.tooltip-container {
    position: fixed;
    z-index: 1000;
    background-color: #333;
    color: white;
    padding: 5px 5px;
    border-radius: 4px;
    font-size: 14px;
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
    pointer-events: none;
    white-space: normal;
    word-wrap: break-word;
    max-width: 200px;
    text-align: center;
}

.tooltip-container.tooltip-visible {
    opacity: 1;
}
</style>
`;

const adjustTooltipPosition = (tooltipContainer, rect) => {
    const tooltipWidth = tooltipContainer.offsetWidth;
    const viewportWidth = window.innerWidth;

    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    if (left < 0) {
        left = 10;
    } else if (left + tooltipWidth > viewportWidth) {
        left = viewportWidth - tooltipWidth - 10;
    }

    let top = rect.bottom + 6;
    if (top + tooltipContainer.offsetHeight > window.innerHeight) {
        top = rect.top - tooltipContainer.offsetHeight - 6;
    }

    tooltipContainer.style.left = `${left}px`;
    tooltipContainer.style.top = `${top}px`;
};

export function enableTooltips(rootElement) {
    const styleTag = document.createElement('style');
    styleTag.textContent = tooltipStyles.match(/<style>(.*)<\/style>/s)[1];
    document.head.appendChild(styleTag);

    try {
        const tooltipElements = rootElement.querySelectorAll('[tooltip]');
        
        tooltipElements.forEach(element => {
            const tooltipContainer = document.createElement('div');
            tooltipContainer.className = 'tooltip-container';
            
            const tooltipText = document.createElement('span');
            tooltipText.className = 'tooltip-text';
            tooltipText.textContent = element.getAttribute('tooltip');
            
            tooltipContainer.appendChild(tooltipText);
            
            let tooltipTimeout;
            let isTooltipVisible = false;
            let touchStartTime = 0;
            
            const showTooltip = () => {
                if (tooltipTimeout) {
                    clearTimeout(tooltipTimeout);
                }
                
                tooltipTimeout = setTimeout(() => {
                    const rect = element.getBoundingClientRect();
                    tooltipContainer.style.position = 'fixed';
                    
                    if (!tooltipContainer.parentNode) {
                        document.body.appendChild(tooltipContainer);
                    }
                    
                    adjustTooltipPosition(tooltipContainer, rect);
                    tooltipContainer.offsetWidth;
                    tooltipContainer.classList.add('tooltip-visible');
                    isTooltipVisible = true;
                }, 500);
            };
            
            const hideTooltip = () => {
                if (tooltipTimeout) {
                    clearTimeout(tooltipTimeout);
                }
                
                if (isTooltipVisible && tooltipContainer.parentNode) {
                    tooltipContainer.classList.remove('tooltip-visible');
                    isTooltipVisible = false;
                    
                    setTimeout(() => {
                        if (tooltipContainer.parentNode) {
                            document.body.removeChild(tooltipContainer);
                        }
                    }, 200);
                }
            };

            // Mouse event handlers
            element.addEventListener('mouseenter', showTooltip);
            element.addEventListener('mouseleave', hideTooltip);

            // Touch event handlers
            element.addEventListener('touchstart', (e) => {
                touchStartTime = Date.now();
                showTooltip();
                
                // Prevent context menu on long press
                element.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                }, { once: true });
            }, { passive: true });

            element.addEventListener('touchend', (e) => {
                const touchDuration = Date.now() - touchStartTime;
                
                // If touch was short (like a tap), hide immediately
                if (touchDuration < 300) {
                    hideTooltip();
                }
                // For longer touches, hide after a short delay
                else {
                    setTimeout(hideTooltip, 100);
                }
                
                touchStartTime = 0;
            }, { passive: true });

            // Ensure tooltip hides on any touch cancellation
            element.addEventListener('touchcancel', () => {
                touchStartTime = 0;
                hideTooltip();
            }, { passive: true });

            // Handle touch moving away
            element.addEventListener('touchmove', () => {
                hideTooltip();
            }, { passive: true });

            // Global handlers to ensure tooltip cleanup
            window.addEventListener('scroll', hideTooltip, { passive: true });
            window.addEventListener('resize', hideTooltip, { passive: true });
            
            // Cleanup when leaving the page
            window.addEventListener('beforeunload', hideTooltip);
        });
    } catch(error) {
        console.error('Error initializing tooltips:', error);
    }
}