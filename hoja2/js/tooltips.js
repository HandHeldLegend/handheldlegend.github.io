const tooltipStyles = `
<style>
.tooltip-container {
    position: fixed;
    z-index: 1000;
    background-color: #333;
    color: white;
    padding: 5px 10px;
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

@media (max-width: 768px) {
    .tooltip-container {
        padding: 12px 20px;
        font-size: 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        max-width: 90%;
        width: fit-content;
    }
}

.tooltip-container.tooltip-visible {
    opacity: 1;
}
</style>
`;

const isMobile = () => window.innerWidth <= 768;

const getMobilePosition = (touchX, touchY, tooltipWidth, tooltipHeight) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 20; // Minimum padding from screen edges
    const thumbOffset = 70; // Space to avoid thumb obstruction

    // Start with a position above the touch point to avoid the thumb
    let left = touchX - (tooltipWidth / 2);
    let top = touchY - tooltipHeight - thumbOffset;

    // If tooltip would go off the top, position it below the touch point instead
    if (top < padding) {
        top = touchY + thumbOffset;
    }

    // Ensure left/right bounds
    if (left < padding) {
        left = padding;
    } else if (left + tooltipWidth > viewportWidth - padding) {
        left = viewportWidth - tooltipWidth - padding;
    }

    // Final bounds check for top/bottom
    if (top + tooltipHeight > viewportHeight - padding) {
        top = viewportHeight - tooltipHeight - padding;
    }
    if (top < padding) {
        top = padding;
    }

    return { left, top };
};

const adjustTooltipPosition = (tooltipContainer, rect, touchX = null, touchY = null) => {
    if (isMobile() && touchX !== null && touchY !== null) {
        // Get tooltip dimensions
        const tooltipWidth = tooltipContainer.offsetWidth;
        const tooltipHeight = tooltipContainer.offsetHeight;
        
        // Calculate position based on touch point
        const position = getMobilePosition(touchX, touchY, tooltipWidth, tooltipHeight);
        
        tooltipContainer.style.left = `${position.left}px`;
        tooltipContainer.style.top = `${position.top}px`;
        tooltipContainer.style.transform = 'none';
    } else {
        // Desktop positioning - centered below element with screen boundary checks
        const tooltipWidth = tooltipContainer.offsetWidth;
        const tooltipHeight = tooltipContainer.offsetHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        let top = rect.bottom + 6;

        // Adjust horizontal position if it would overflow
        if (left < 10) {
            left = 10;
        } else if (left + tooltipWidth > viewportWidth - 10) {
            left = viewportWidth - tooltipWidth - 10;
        }

        // If tooltip would overflow bottom, position it above the element
        if (top + tooltipHeight > viewportHeight - 10) {
            top = rect.top - tooltipHeight - 6;
        }

        tooltipContainer.style.left = `${left}px`;
        tooltipContainer.style.top = `${top}px`;
        tooltipContainer.style.transform = 'none';
    }
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
            let touchStartX = 0;
            let touchStartY = 0;
            
            const showTooltip = (touchX = null, touchY = null) => {
                if (tooltipTimeout) {
                    clearTimeout(tooltipTimeout);
                }
                
                tooltipTimeout = setTimeout(() => {
                    const rect = element.getBoundingClientRect();
                    
                    if (!tooltipContainer.parentNode) {
                        document.body.appendChild(tooltipContainer);
                    }
                    
                    adjustTooltipPosition(tooltipContainer, rect, touchX, touchY);
                    tooltipContainer.offsetWidth; // Force reflow
                    tooltipContainer.classList.add('tooltip-visible');
                    isTooltipVisible = true;
                }, isMobile() ? 300 : 500);
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

            // Mouse event handlers (desktop only)
            if (!isMobile()) {
                element.addEventListener('mouseenter', () => showTooltip());
                element.addEventListener('mouseleave', hideTooltip);
            }

            // Touch event handlers
            element.addEventListener('touchstart', (e) => {
                touchStartTime = Date.now();
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                showTooltip(touchStartX, touchStartY);
                
                // Prevent context menu on long press
                element.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                }, { once: true });
            }, { passive: true });

            element.addEventListener('touchend', (e) => {
                const touchDuration = Date.now() - touchStartTime;
                
                // For mobile, keep tooltip visible slightly longer on long press
                if (isMobile() && touchDuration > 300) {
                    setTimeout(hideTooltip, 1000);
                } else {
                    hideTooltip();
                }
                
                touchStartTime = 0;
                touchStartX = 0;
                touchStartY = 0;
            }, { passive: true });

            // Handle touch cancellation and movement
            element.addEventListener('touchcancel', hideTooltip, { passive: true });
            element.addEventListener('touchmove', hideTooltip, { passive: true });

            // Global handlers
            window.addEventListener('scroll', hideTooltip, { passive: true });
            window.addEventListener('resize', hideTooltip, { passive: true });
            window.addEventListener('beforeunload', hideTooltip);
        });
    } catch(error) {
        //console.error('Error initializing tooltips:', error);
    }
}