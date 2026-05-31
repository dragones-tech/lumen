# Validation

One source of truth: define the rules on the `Model`, call `model.validate()`, and the UI
renders the returned errors. (Validation is a domain concern — the model knows what valid
data is — unlike persistence, which lives elsewhere.)

## Philosophy

- **Rules live with the model.** `static rules` on the model; the UI doesn't redefine them.
- **`validate()` returns; nothing is magic.** It does not block `set` or auto-render — you call it when it makes sense (on submit, on blur, on input) and render the result.
- **Composable, pure rules.** Each rule is `(value, data) => string | null`. Bring your own.

## Defining rules on a model

```js
import { Model, required, email, minLength, match } from 'lumen';

class Signup extends Model {
  static rules = {
    email:    [required(), email()],
    password: [required(), minLength(8)],
    confirm:  [match('password', 'passwords must match')],
  };
}

const user = new Signup({ email: 'bad', password: '123', confirm: '' });
user.validate();  // { email: ['must be a valid email'], password: ['must be at least 8 characters'], confirm: ['passwords must match'] }
user.isValid();   // false
```

`validate()` returns errors keyed by field — an empty object means valid. Override
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

## Rendering errors in a View

Set the form fields into the model, validate, and paint the errors into per-field slots:

```js
class SignupForm extends View {
  static template = '#signup';
  onMount() { this.listen(this.ui.form, 'submit', this.submit); }
  submit = (e) => {
    e.preventDefault();
    this.props.model.set({
      email: this.ui.email.value,
      password: this.ui.password.value,
      confirm: this.ui.confirm.value,
    });
    const errors = this.props.model.validate();
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
- Standalone use: `runRules(anyData, rules)` works without a model (e.g. validate raw form values directly).
