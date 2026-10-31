/**
 * BORO Vanilla JS Client Handlers
 * Fidelity Modern UX, Accessibility & Dialog Management
 */

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Drawer Navigation
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const closeBtn = document.getElementById('mobile-drawer-close');
  const drawer = document.getElementById('mobile-drawer');
  const backdrop = document.getElementById('mobile-drawer-backdrop');

  function openDrawer() {
    if (drawer) {
      drawer.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeDrawer() {
    if (drawer) {
      drawer.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  if (toggleBtn) toggleBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  // User Profile Dropdown Toggle
  const userMenuBtn = document.getElementById('user-menu-button');
  const userMenuDropdown = document.getElementById('user-dropdown-menu');

  if (userMenuBtn && userMenuDropdown) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = userMenuBtn.getAttribute('aria-expanded') === 'true';
      userMenuBtn.setAttribute('aria-expanded', !isExpanded);
      userMenuDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!userMenuBtn.contains(e.target) && !userMenuDropdown.contains(e.target)) {
        userMenuDropdown.classList.add('hidden');
        userMenuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Auto-dismiss Flash Toasts after 5 seconds
  const toasts = document.querySelectorAll('.toast-alert');
  toasts.forEach(toast => {
    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      setTimeout(() => toast.remove(), 400);
    }, 5000);
  });

  // Universal ReasonDialog Management
  const defaultModal = document.getElementById('reason-modal');
  const modalForm = document.getElementById('reason-modal-form');
  const modalTextarea = document.getElementById('reason-modal-reason');
  const modalError = document.getElementById('reason-modal-error');
  const modalTitle = document.getElementById('reason-modal-title');
  const modalPrompt = document.getElementById('reason-modal-prompt');
  const modalSubmit = document.getElementById('reason-modal-submit');

  if (modalForm && modalTextarea) {
    modalForm.addEventListener('submit', (e) => {
      const reasonVal = (modalTextarea.value || '').trim();
      if (!reasonVal) {
        e.preventDefault();
        modalTextarea.classList.add('border-status-danger', 'ring-1', 'ring-status-danger');
        if (modalError) modalError.classList.remove('hidden');
        modalTextarea.focus();
        return false;
      }
      modalTextarea.classList.remove('border-status-danger', 'ring-1', 'ring-status-danger');
      if (modalError) modalError.classList.add('hidden');
    });

    modalTextarea.addEventListener('input', () => {
      if (modalTextarea.value.trim()) {
        modalTextarea.classList.remove('border-status-danger', 'ring-1', 'ring-status-danger');
        if (modalError) modalError.classList.add('hidden');
      }
    });
  }

  window.openReasonDialog = function(target, title, promptText, actionLabel, isDestructive) {
    // If target is an existing element ID
    const explicitEl = document.getElementById(target);
    if (explicitEl && explicitEl.getAttribute('role') === 'dialog') {
      explicitEl.classList.remove('hidden');
      const ta = explicitEl.querySelector('textarea');
      if (ta) {
        ta.value = '';
        ta.focus();
      }
      return;
    }

    // Otherwise use default universal dialog 'reason-modal' with dynamic target URL
    if (defaultModal) {
      if (modalForm) modalForm.action = target;
      if (modalTitle && title) modalTitle.textContent = title;
      if (modalPrompt && promptText) modalPrompt.textContent = promptText;
      if (modalSubmit && actionLabel) modalSubmit.textContent = actionLabel;
      if (modalSubmit) {
        if (isDestructive) {
          modalSubmit.className = 'btn btn-secondary text-xs py-2 px-4 font-semibold text-status-danger border-status-danger/40 hover:bg-status-danger/10';
        } else {
          modalSubmit.className = 'btn btn-primary text-xs py-2 px-4 font-semibold';
        }
      }
      if (modalTextarea) {
        modalTextarea.value = '';
        modalTextarea.classList.remove('border-status-danger', 'ring-1', 'ring-status-danger');
        if (modalError) modalError.classList.add('hidden');
      }
      defaultModal.classList.remove('hidden');
      if (modalTextarea) modalTextarea.focus();
    }
  };

  window.closeReasonDialog = function(dialogId) {
    const dialog = document.getElementById(dialogId || 'reason-modal');
    if (dialog) {
      dialog.classList.add('hidden');
    }
  };

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openDialogs = document.querySelectorAll('[role="dialog"]:not(.hidden)');
      openDialogs.forEach(d => d.classList.add('hidden'));
      closeDrawer();
    }
  });
});
