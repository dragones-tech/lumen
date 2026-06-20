# Validation

One source of truth: define the rules on the `Model`, call `model.validate()`, and the UI
renders the returned errors. (Validation is a domain concern — the model knows what valid
data is — unlike persistence, which lives elsewhere.)

## Philosophy

- **Rules live with the model.** `static rules` on the model; the UI doesn't redefine them.
- **`validate()` returns; nothing is magic.** It does not block `set` or auto-render — you `await` it when it makes sense (on submit, on blur, on input) and render the result.
- **Composable rules, sync or async.** Each rule is `(value, data) => string | null | Promise<string | null>`. A server-side check (e.g. "email already taken?") is just a rule that returns a Promise — same path, no separate async validator. Bring your own.

## Defining rules on a model

```js
import { Model, required, email, minLength, match } from 'lumenjs';

class Signup extends Model {
  static rules = {
    email:    [required(), email()],
    password: [required(), minLength(8)],
    confirm:  [match('password', 'passwords must match')],
  };
}

const user = new Signup({ email: 'bad', password: '123', confirm: '' });
await user.validate();  // { email: ['must be a valid email'], password: ['must be at least 8 characters'], confirm: ['passwords must match'] }
await user.isValid();   // false
```

`validate()` resolves to errors keyed by field — an empty object means valid. It is **async**
so a rule can hit the server; sync-only rules just resolve on the next microtask. Override
`validate()` for custom cross-field logic.

## Built-in rules

| Rule | Fails when |
|---|---|
| `required(msg?)` | value is empty/null/undefined |
| `minLength(n, msg?)` / `maxLength(n, msg?)` | string length out of range |
| `pattern(re, msg?)` | doesn't match the regex |
| `email(msg?)` | not an email |
| `min(n, msg?)` / `max(n, msg?)` | number out of range |
| `match(field, msg?)` | not equal to another field |
| custom: `(value, data) => msg \| null` | your logic returns a message |
| async: `(value, data) => Promise<msg \| null>` | an awaited check (e.g. a server lookup) returns a message |

### An async rule

A rule that returns a Promise is awaited like any other — no special registration:

```js
const emailAvailable = (msg = 'is already taken') => async (value) => {
  if (!value) return null;                       // let `required()` own emptiness
  const { taken } = await api.get('/check-email', { query: { value } });
  return taken ? msg : null;
};

class Signup extends Model {
  static rules = { email: [required(), email(), emailAvailable()] };
}

await new Signup({ email: 'ada@x.io' }).validate(); // awaits the server check
```

## Rendering errors in a View

Set the form fields into the model, validate, and paint the errors into per-field slots:

```js
class SignupForm extends View {
  static template = '#signup';
  onMount() { this.listen(this.ui.form, 'submit', this.submit); }
  submit = async (e) => {
    e.preventDefault();
    this.props.model.set({
      email: this.ui.email.value,
      password: this.ui.password.value,
      confirm: this.ui.confirm.value,
    });
    const errors = await this.props.model.validate();
    this.showErrors(errors);
    if (Object.keys(errors).length === 0) this.props.onValid();
  };
  showErrors(errors) {
    for (const field of ['email', 'password', 'confirm']) {
      this.ui[field + 'Err'].textContent = errors[field]?.[0] ?? '';
    }
  }
}
```

The model is the single source of truth; the view only renders what `validate()` returns.

## Using native constraints too (optional)

For instant browser feedback you can still add `required`/`type="email"`/`pattern` to inputs
and use the platform's Constraint Validation API (`form.checkValidity()`,
`input.setCustomValidity(msg)`). The model rules remain the authority; native constraints
are a UX nicety on top.

## Design notes

- `validate.js` imports nothing (pure leaf). `Model` imports `runRules` from it — a clean one-directional dependency (no cycle).
- `runRules` is **async** (returns a Promise): it `await`s each rule, runs them in declaration order, and a field collects every failure (it does not short-circuit on the first).
- Standalone use: `await runRules(anyData, rules)` works without a model (e.g. validate raw form values directly).
