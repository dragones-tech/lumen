# Validación

Una sola fuente de verdad: defines las reglas en el `Model`, llamas a `model.validate()`, y
la UI pinta los errores devueltos. (La validación es una regla de dominio — el modelo sabe
qué datos son válidos — a diferencia de la persistencia, que vive en otra capa.)

## Filosofía

- **Las reglas viven en el modelo.** `static rules` en el modelo; la UI no las redefine.
- **`validate()` devuelve; nada es mágico.** No bloquea `set` ni renderiza solo — haces `await` cuando tiene sentido (al enviar, al salir del campo, al teclear) y pintas el resultado.
- **Reglas componibles, síncronas o async.** Cada regla es `(value, data) => string | null | Promise<string | null>`. Una comprobación en servidor (p. ej. "¿email ya en uso?") es solo una regla que devuelve una Promesa — mismo camino, sin validador async aparte. Pon las tuyas.

## Definir reglas en un modelo

```js
import { Model, required, email, minLength, match } from 'lumenjs';

class Signup extends Model {
  static rules = {
    email:    [required(), email()],
    password: [required(), minLength(8)],
    confirm:  [match('password', 'las contraseñas deben coincidir')],
  };
}

const user = new Signup({ email: 'mal', password: '123', confirm: '' });
await user.validate();  // { email: ['must be a valid email'], password: [...], confirm: [...] }
await user.isValid();   // false
```

`validate()` resuelve a errores por campo — un objeto vacío significa válido. Es **async**
para que una regla pueda consultar al servidor; las reglas solo-síncronas resuelven en el
siguiente microtask. Sobreescribe `validate()` para lógica entre campos.

## Reglas incluidas

| Regla | Falla cuando |
|---|---|
| `required(msg?)` | el valor está vacío/null/undefined |
| `minLength(n, msg?)` / `maxLength(n, msg?)` | longitud de string fuera de rango |
| `pattern(re, msg?)` | no coincide con la regex |
| `email(msg?)` | no es un email |
| `min(n, msg?)` / `max(n, msg?)` | número fuera de rango |
| `match(field, msg?)` | no es igual a otro campo |
| propia: `(value, data) => msg \| null` | tu lógica devuelve un mensaje |
| async: `(value, data) => Promise<msg \| null>` | una comprobación awaited (p. ej. consulta al servidor) devuelve un mensaje |

### Una regla async

Una regla que devuelve una Promesa se espera como cualquier otra — sin registro especial:

```js
const emailAvailable = (msg = 'ya está en uso') => async (value) => {
  if (!value) return null;                       // deja que `required()` maneje el vacío
  const { taken } = await api.get('/check-email', { query: { value } });
  return taken ? msg : null;
};

class Signup extends Model {
  static rules = { email: [required(), email(), emailAvailable()] };
}

await new Signup({ email: 'ada@x.io' }).validate(); // espera la comprobación del servidor
```

## Pintar errores en una View

Mete los campos del form en el modelo, valida, y pinta los errores en slots por campo:

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

El modelo es la única fuente de verdad; la vista solo pinta lo que `validate()` devuelve.

## Usar también las restricciones nativas (opcional)

Para feedback instantáneo del navegador puedes añadir `required`/`type="email"`/`pattern` a
los inputs y usar la Constraint Validation API de la plataforma (`form.checkValidity()`,
`input.setCustomValidity(msg)`). Las reglas del modelo siguen siendo la autoridad; las
restricciones nativas son un extra de UX encima.

## Notas de diseño

- `validate.js` no importa nada (hoja pura). `Model` importa `runRules` de ahí — una dependencia limpia en una sola dirección (sin ciclo).
- `runRules` es **async** (devuelve una Promesa): hace `await` de cada regla, las corre en orden de declaración, y un campo acumula todos los fallos (no se corta en el primero).
- Uso independiente: `await runRules(cualquierData, rules)` funciona sin modelo (p. ej. validar valores de form directamente).
