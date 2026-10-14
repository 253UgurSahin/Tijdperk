import { $, compact } from '../core/dom';
import { worldEl } from '../render/scene';

export function measureHud() {
    const ds = document.documentElement.style, w = worldEl.getBoundingClientRect();
    if (compact()) {
        const bt = Math.max(...['#ageplate', '#resPanel', '#objectives'].map(s => $(s).getBoundingClientRect().bottom));
        ds.setProperty('--topH', Math.round(bt - w.top) + 'px');
        ds.setProperty('--barH', $('#bar').offsetHeight + 'px');
    }
    else {
        ds.removeProperty('--topH');
        ds.removeProperty('--barH');
    }
}
try {
    const ro = new ResizeObserver(measureHud);
    for (const s of ['#ageplate', '#resPanel', '#objectives', '#bar'])
        ro.observe($(s));
}
catch (e) {
    addEventListener('resize', measureHud);
}
