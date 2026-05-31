// @ts-check
// A complete little app for the landing page — built with Lumen, styled with Tailwind.
// It combines Model + Collection + CollectionView + View + animations.
import { View, Model, Collection, CollectionView, slideIn, slideOut } from 'lumen';

class Todo extends Model {}

class TodoItem extends View {
  static template = '#demo-item';
  onMount() {
    const { model } = this.props;
    this.ui.text.textContent = model.get('text');
    this.ui.check.checked = model.get('done');
    this.paint();
    this.listen(this.ui.check, 'change', this.toggle);
    this.listen(this.ui.remove, 'click', this.remove);
    model.on('change:done', this.paint, { signal: this.signal });
  }
  toggle = () => { this.props.model.set('done', this.ui.check.checked); this.props.onToggle(); };
  remove = () => this.props.onRemove(this.props.model);
  paint = () => this.ui.text.classList.toggle('line-through', this.props.model.get('done'));
  animateIn() { return slideIn(this.el); }
  animateOut() { return slideOut(this.el); }
}

class TodoApp extends CollectionView {
  static template = '#demo-app';
  static childView = TodoItem;
  static container = 'list';
  onMount() {
    super.onMount();
    this.listen(this.ui.form, 'submit', this.add);
    this.collection.on('add', this.count, { signal: this.signal });
    this.collection.on('remove', this.count, { signal: this.signal });
    this.count();
  }
  add = (e) => {
    e.preventDefault();
    const text = this.ui.input.value.trim();
    if (text) this.collection.add({ text, done: false });
    this.ui.input.value = '';
    this.ui.input.focus();
  };
  count = () => { this.ui.count.textContent = this.collection.where({ done: false }).length; };
  childProps(model) {
    return { onRemove: (m) => this.collection.remove(m), onToggle: () => this.count() };
  }
}

/**
 * Build a ready-to-mount TodoApp for the landing page.
 * @param {'en'|'es'} [lang]
 * @returns {TodoApp}
 */
export function createTodoApp(lang = 'en') {
  const seed = lang === 'es'
    ? [{ text: 'Probar Lumen', done: true }, { text: 'Construir algo', done: false }]
    : [{ text: 'Try Lumen', done: true }, { text: 'Build something', done: false }];
  return new TodoApp({ collection: new Collection(seed, Todo) });
}

/** The source shown next to the running demo on the landing page. */
export const TODO_SOURCE = `import { View, Model, Collection, CollectionView,
         slideIn, slideOut } from 'lumen';

class Todo extends Model {}

class TodoItem extends View {
  static template = '#todo-item';
  onMount() {
    const { model } = this.props;
    this.ui.text.textContent = model.get('text');
    this.listen(this.ui.check, 'change', this.toggle);
    this.listen(this.ui.remove, 'click', this.remove);
    model.on('change:done', this.paint, { signal: this.signal });
  }
  toggle = () => this.props.model.set('done', this.ui.check.checked);
  remove = () => this.props.onRemove(this.props.model);
  animateIn()  { return slideIn(this.el); }   // slides in on add
  animateOut() { return slideOut(this.el); }  // plays before removal
}

class TodoApp extends CollectionView {
  static template  = '#todo-app';
  static childView = TodoItem;        // one view per model
  static container = 'list';          // keyed reconciliation
  onMount() {
    super.onMount();
    this.listen(this.ui.form, 'submit', this.add);
  }
  add = (e) => {
    e.preventDefault();
    this.collection.add({ text: this.ui.input.value, done: false });
    this.ui.input.value = '';
  };
  childProps(model) {
    return { onRemove: (m) => this.collection.remove(m) };
  }
}

new TodoApp({ collection: new Collection([], Todo) })
  .mount(document.querySelector('#app'));`;
