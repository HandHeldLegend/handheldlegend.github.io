// tooltips.js
// CSS for tooltips (can be added to a separate CSS file)
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
    word-wrap: break-word; /* Break long words if necessary */
    max-width: 200px; /* Optional: Set a max-width to prevent tooltips from becoming too wide */
    text-align: center;
}

.tooltip-container.tooltip-visible {
    opacity: 1;
}
</style>
`;

const adjustTooltipPosition = (tooltipContainer, rect) => {
    // Calculate initial position
    const tooltipWidth = tooltipContainer.offsetWidth;
    const viewportWidth = window.innerWidth;

    // Horizontal adjustment
    let left = rect.left + rect.width / 2 - tooltipWidth / 2; // Center horizontally
    if (left < 0) {
        left = 10; // Nudge away from the left edge
    } else if (left + tooltipWidth > viewportWidth) {
        left = viewportWidth - tooltipWidth - 10; // Nudge away from the right edge
    }

    // Vertical adjustment
    let top = rect.bottom + 6; // Tooltip below the element
    if (top + tooltipContainer.offsetHeight > window.innerHeight) {
        top = rect.top - tooltipContainer.offsetHeight - 6; // Move above if it overflows
    }

    // Apply calculated positions
    tooltipContainer.style.left = `${left}px`;
    tooltipContainer.style.top = `${top}px`;
};

export function enableTooltips(rootElement) {
    // Inject tooltip styles into the document
    const styleTag = document.createElement('style');
    styleTag.textContent = tooltipStyles.match(/<style>(.*)<\/style>/s)[1];
    document.head.appendChild(styleTag);

    try
    {
        const tooltipElements = rootElement.querySelectorAll('[tooltip]');
        
        tooltipElements.forEach(element => {
            // Create tooltip container
            const tooltipContainer = document.createElement('div');
            tooltipContainer.className = 'tooltip-container';
            
            // Create tooltip text element
            const tooltipText = document.createElement('span');
            tooltipText.className = 'tooltip-text';
            tooltipText.textContent = element.getAttribute('tooltip');
            
            // Append tooltip to container
            tooltipContainer.appendChild(tooltipText);
            
            // Positioning and visibility logic
            let tooltipTimeout;
            
            const showTooltip = () => {
                tooltipTimeout = setTimeout(() => {
                    // Position the tooltip
                    const rect = element.getBoundingClientRect();
                    tooltipContainer.style.position = 'fixed';
                    //tooltipContainer.style.left = `${rect.left + rect.width / 2}px`;
                    //tooltipContainer.style.top = `${rect.bottom + 6}px`;
                    //tooltipContainer.style.transform = 'translateX(-50%)';
                    
                    // Add to document and show
                    document.body.appendChild(tooltipContainer);

                    // Adjust position to stay within the viewport
                    adjustTooltipPosition(tooltipContainer, rect);
                    
                    // Trigger reflow to enable transition
                    tooltipContainer.offsetWidth;
                    tooltipContainer.classList.add('tooltip-visible');
                }, 500); // 0.5 seconds delay
            };
            
            const hideTooltip = () => {
                // Clear the timeout to prevent showing if mouse leaves quickly
                clearTimeout(tooltipTimeout);
                
                // Remove tooltip if it exists
                if (tooltipContainer.parentNode) {

                    try {
                        tooltipContainer.classList.remove('tooltip-visible');
                        setTimeout(() => {
                            document.body.removeChild(tooltipContainer);
                        }, 200); // Match transition time
                    }
                    catch(err) {}
                    
                }
            };
            
            // Add event listeners
            element.addEventListener('mouseenter', showTooltip);
            element.addEventListener('mouseleave', hideTooltip);

            // Event listeners (mobile)
            element.addEventListener('touchstart', showTooltip);
            element.addEventListener('touchend', hideTooltip);
            element.addEventListener('touchcancel', hideTooltip); // Handle canceled touches
        });

    }
    catch(error) {
        
    }
}

