# @lucas-barake/effect-form

Type-safe form state management powered by Effect Schema.

## Installation

```bash
pnpm add @lucas-barake/effect-form-react
```

## Creating a Login Form

Let's create a simple login form with email and password validation.

We use `Form.empty` to start building, `.addField()` to add fields with Effect Schema validation, and `FormReact.build()` to create React components.

```tsx
import { Form } from "@lucas-barake/effect-form"
import { FormReact } from "@lucas-barake/effect-form-react"
import * as Atom from "@effect-atom/atom/Atom"
import * as Schema from "effect/Schema"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Layer from "effect/Layer"

const runtime = Atom.runtime(Layer.empty)

const loginForm = Form.empty
  .addField("email", Schema.String.pipe(Schema.nonEmptyString()))
  .addField("password", Schema.String.pipe(Schema.minLength(8)))

const form = FormReact.build(loginForm, {
  runtime,
  fields: {
    email: ({ value, onChange, onBlur, error }) => (
      <div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        {Option.isSome(error) && <span>{error.value}</span>}
      </div>
    ),
    password: ({ value, onChange, onBlur, error }) => (
      <div>
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        {Option.isSome(error) && <span>{error.value}</span>}
      </div>
    ),
  },
})

const handleSubmit = form.submit((values) =>
  Effect.log(`Login: ${values.email}`)
)

function LoginPage() {
  const { submit, isDirty } = form.useForm()

  return (
    <form.Form
      defaultValues={{ email: "", password: "" }}
      onSubmit={handleSubmit}
    >
      <form.email />
      <form.password />
      <button onClick={submit} disabled={!isDirty}>
        Login
      </button>
    </form.Form>
  )
}
```

## Validation Modes

By default, validation runs on submit. You can change this with the `validationMode` build option.

```tsx
const form = FormReact.build(loginForm, {
  runtime,
  fields: { email: EmailInput, password: PasswordInput },
  validationMode: "onBlur", // "onSubmit" | "onBlur" | "onChange"
})
```

## Subscribing to Form State

Use `form.Subscribe` for render-prop access to form state, or `form.useForm()` as a hook.

```tsx
function LoginDialog({ onClose }) {
  // onSubmit can access component scope (e.g., close dialog)
  const handleSubmit = form.submit((values) =>
    Effect.gen(function* () {
      yield* saveUser(values)
      onClose()
    })
  )

  return (
    <form.Form defaultValues={{ email: "", password: "" }} onSubmit={handleSubmit}>
      <form.email />
      <form.password />

      {/* Render-prop pattern */}
      <form.Subscribe>
        {({ isDirty, isSubmitting, submit }) => (
          <button onClick={submit} disabled={!isDirty || isSubmitting}>
            {isSubmitting ? "Saving..." : "Login"}
          </button>
        )}
      </form.Subscribe>
    </form.Form>
  )
}
```

## Cross-Field Validation

Use `.refine()` to validate relationships between fields. The `ctx.error()` helper routes errors to specific fields.

```ts
const signupForm = Form.empty
  .addField("password", Schema.String)
  .addField("confirmPassword", Schema.String)
  .refine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      return ctx.error("confirmPassword", "Passwords must match")
    }
  })
```

For async validation, use `.refineEffect()`:

```ts
const signupForm = Form.empty
  .addField("username", Schema.String)
  .refineEffect((values, ctx) =>
    Effect.gen(function* () {
      const taken = yield* checkUsernameAvailability(values.username)
      if (taken) {
        return ctx.error("username", "Username is already taken")
      }
    })
  )
```

## Array Fields

Use `.addArray()` with a nested form definition for dynamic lists.

```tsx
const itemForm = Form.empty.addField("name", Schema.String)

const orderForm = Form.empty
  .addField("title", Schema.String)
  .addArray("items", itemForm)

const form = FormReact.build(orderForm, {
  runtime,
  fields: {
    title: TitleInput,
    items: { name: NameInput },
  },
})

function OrderPage() {
  return (
    <form.Form defaultValues={{ title: "", items: [] }} onSubmit={handleSubmit}>
      <form.title />
      <form.items>
        {({ items, append, remove }) => (
          <>
            {items.map((_, index) => (
              <form.items.Item key={index} index={index}>
                {({ remove }) => (
                  <div>
                    <form.items.name />
                    <button onClick={remove}>Remove</button>
                  </div>
                )}
              </form.items.Item>
            ))}
            <button onClick={() => append()}>Add Item</button>
          </>
        )}
      </form.items>
    </form.Form>
  )
}
```

Array operations: `append`, `remove`, `swap`, `move`.

## Reusing Field Groups

Use `.merge()` to compose forms from reusable field definitions.

```ts
const addressFields = Form.empty
  .addField("street", Schema.String)
  .addField("city", Schema.String)
  .addField("zipCode", Schema.String)

const userForm = Form.empty
  .addField("name", Schema.String)
  .merge(addressFields)

const companyForm = Form.empty
  .addField("companyName", Schema.String)
  .merge(addressFields)
```

## Field Component Props

Each field component receives:

```ts
interface FieldComponentProps<S extends Schema.Schema.Any> {
  value: Schema.Schema.Encoded<S>
  onChange: (value: Schema.Schema.Encoded<S>) => void
  onBlur: () => void
  error: Option.Option<string>
  isTouched: boolean
  isValidating: boolean
  isDirty: boolean
}
```

## License

MIT
