// DOM Elements
const navbar = document.getElementById('navbar');
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');
const links = document.querySelectorAll('.nav-links li');
const scrollElements = document.querySelectorAll('.fade-in, .slide-up');

// Navbar Scroll Effect
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile Menu Toggle
hamburger.addEventListener('click', () => {
    // Toggle Nav
    navLinks.classList.toggle('nav-active');
    
    // Burger Animation
    hamburger.classList.toggle('toggle');
});

// Close mobile menu when clicking a link
links.forEach(link => {
    link.addEventListener('click', () => {
        if (navLinks.classList.contains('nav-active')) {
            navLinks.classList.remove('nav-active');
            hamburger.classList.remove('toggle');
        }
    });
});

// Scroll Animation Observer
const elementInView = (el, dividend = 1) => {
    const elementTop = el.getBoundingClientRect().top;
    return (elementTop <= (window.innerHeight || document.documentElement.clientHeight) / dividend);
};

const displayScrollElement = (element) => {
    element.classList.add('appear');
};

const handleScrollAnimation = () => {
    scrollElements.forEach((el) => {
        if (elementInView(el, 1.1)) {
            displayScrollElement(el);
        }
    })
}

// Initial check for elements in view
window.addEventListener('load', handleScrollAnimation);

// Check elements on scroll
window.addEventListener('scroll', () => {
    handleScrollAnimation();
});

// Smooth Scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            // Adjust scroll position to account for fixed navbar
            const navHeight = navbar.offsetHeight;
            const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navHeight;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// WhatsApp Form Submission Logic
const waForm = document.getElementById('whatsapp-form');
if (waForm) {
    waForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('wa-name').value.trim();
        const phone = document.getElementById('wa-phone').value.trim();
        const email = document.getElementById('wa-email').value.trim();
        const message = document.getElementById('wa-message').value.trim();
        
        if (!name || !phone || !email || !message) {
            alert('Por favor, completa todos los campos.');
            return;
        }

        const waNumber = '1234567890'; // Replace with actual WhatsApp number
        const textMessage = `Hola Lili, mi nombre es ${name}.\n\nTeléfono: ${phone}\nEmail: ${email}\n\nMensaje:\n${message}`;
        
        const encodedMessage = encodeURIComponent(textMessage);
        const waUrl = `https://wa.me/${waNumber}?text=${encodedMessage}`;
        
        window.open(waUrl, '_blank');
        
        waForm.reset();
    });
}

// Carousel Logic
const track = document.querySelector('.carousel-track');
const slides = Array.from(document.querySelectorAll('.carousel-slide'));
const nextButton = document.querySelector('.next-btn');
const prevButton = document.querySelector('.prev-btn');

if (track && slides.length > 0) {
    let currentIndex = 0;
    const gap = 20;
    const originalLength = slides.length;

    // Clone all slides to create a seamless infinite loop
    slides.forEach(slide => {
        const clone = slide.cloneNode(true);
        track.appendChild(clone);
    });

    const getVisibleCards = () => {
        if (window.innerWidth <= 576) return 1;
        if (window.innerWidth <= 992) return 2;
        return 3;
    };

    const updateCarousel = (instant = false) => {
        const slideWidth = track.children[0].getBoundingClientRect().width;
        const moveDistance = slideWidth + gap;
        
        if (instant) {
            track.style.transition = 'none';
        } else {
            track.style.transition = 'transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)';
        }
        
        track.style.transform = `translateX(-${currentIndex * moveDistance}px)`;
    };

    const goNext = () => {
        // If we have scrolled through the entire original set,
        // instantly reset to position 0 before moving to position 1
        if (currentIndex >= originalLength) {
            currentIndex = 0;
            updateCarousel(true);
            
            // Force browser repaint
            track.offsetHeight;
            
            currentIndex++;
            updateCarousel(false);
        } else {
            currentIndex++;
            updateCarousel(false);
        }
    };

    const goPrev = () => {
        // If we are at the very beginning,
        // instantly jump to the cloned set before moving backwards
        if (currentIndex <= 0) {
            currentIndex = originalLength;
            updateCarousel(true);
            
            track.offsetHeight;
            
            currentIndex--;
            updateCarousel(false);
        } else {
            currentIndex--;
            updateCarousel(false);
        }
    };

    nextButton.addEventListener('click', goNext);
    prevButton.addEventListener('click', goPrev);

    // Handle window resize
    window.addEventListener('resize', () => {
        updateCarousel(true);
    });
    
    // Auto-advance carousel every 4 seconds
    let autoPlay = setInterval(goNext, 4000);
    
    // Pause auto-play on hover
    track.parentElement.addEventListener('mouseenter', () => clearInterval(autoPlay));
    track.parentElement.addEventListener('mouseleave', () => {
        autoPlay = setInterval(goNext, 4000);
    });
}
