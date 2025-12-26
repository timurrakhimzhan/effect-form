# @lucas-barake/effect-form

Type-safe forms powered by Effect Schema.

## Installation

```bash
pnpm add @lucas-barake/effect-form-react
```

## Basic Form

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
        <input value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
        {Option.isSome(error) && <span>{error.value}</span>}
      </div>
    ),
    password: ({ value, onChange, onBlur, error }) => (
      <div>
        <input type="password" value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
        {Option.isSome(error) && <span>{error.value}</span>}
      </div>
    ),
  },
})

const handleSubmit = form.submit((values) => Effect.log(`Login: ${values.email}`))

function LoginPage() {
  const { submit, isDirty } = form.useForm()

  return (
    <form.Form defaultValues={{ email: "", password: "" }} onSubmit={handleSubmit}>
      <form.email />
      <form.password />
      <button onClick={submit} disabled={!isDirty}>Login</button>
    </form.Form>
  )
}
```

## Validation Modes

```tsx
// Default: validate on submit only
FormReact.build(loginForm, { runtime, fields, mode: "onSubmit" })

// Validate on blur
FormReact.build(loginForm, { runtime, fields, mode: "onBlur" })

// Validate on change (immediate)
FormReact.build(loginForm, { runtime, fields, mode: "onChange" })
```

## Debounced Validation

```tsx
FormReact.build(loginForm, {
  runtime,
  fields,
  mode: { onChange: { debounce: "300 millis" } },
})
```

## Auto-Submit

```tsx
// Auto-submit on change (debounced)
FormReact.build(loginForm, {
  runtime,
  fields,
  mode: { onChange: { debounce: "300 millis", autoSubmit: true } },
})

// Auto-submit on blur
FormReact.build(loginForm, {
  runtime,
  fields,
  mode: { onBlur: { autoSubmit: true } },
})
```

## Cross-Field Validation

```tsx
// Sync refinement
const signupForm = Form.empty
  .addField("password", Schema.String)
  .addField("confirmPassword", Schema.String)
  .refine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      return ctx.error("confirmPassword", "Passwords must match")
    }
  })

// Async refinement
const usernameForm = Form.empty
  .addField("username", Schema.String)
  .refineEffect((values, ctx) =>
    Effect.gen(function* () {
      const taken = yield* checkUsernameAvailability(values.username)
      if (taken) {
        return ctx.error("username", "Username is already taken")
      }
    })
  )

// Multiple errors from one refinement
Form.empty
  .addField("email", Schema.String)
  .addField("password", Schema.String)
  .refine((values, ctx) => {
    const errors: Array<Schema.FilterIssue> = []
    if (!values.email.includes("@")) {
      errors.push({ path: ["email"], message: "Invalid email" })
    }
    if (values.password.length < 8) {
      errors.push({ path: ["password"], message: "Too short" })
    }
    return errors.length > 0 ? errors : undefined
  })
```

## Array Fields

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
        {({ items, append, remove, swap, move }) => (
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

## Form State

```tsx
function FormControls() {
  const { submit, reset, isDirty, submitResult, values } = form.useForm()

  return (
    <>
      <button onClick={submit} disabled={!isDirty || submitResult.waiting}>
        {submitResult.waiting ? "Submitting..." : "Submit"}
      </button>
      <button onClick={reset} disabled={!isDirty}>Reset</button>
    </>
  )
}
```

## Subscribe Component

```tsx
<form.Subscribe>
  {({ values, isDirty, submitResult, submit, reset }) => (
    <button onClick={submit} disabled={!isDirty || submitResult.waiting}>
      Submit
    </button>
  )}
</form.Subscribe>
```

## Submit Result

```tsx
import * as Result from "@effect-atom/atom/Result"

function SubmitStatus() {
  const { submitResult } = form.useForm()

  if (submitResult.waiting) return <span>Submitting...</span>
  if (Result.isSuccess(submitResult)) return <span>Success!</span>
  if (Result.isFailure(submitResult)) return <span>Failed</span>
  return null
}
```

## Form Atom

```tsx
import { useAtomValue } from "@effect-atom/atom-react"

function SubmitCount() {
  const state = useAtomValue(form.atom)
  return <span>Submit count: {state.submitCount}</span>
}
```

## Merge Form Builders

```tsx
const addressFields = Form.empty
  .addField("street", Schema.String)
  .addField("city", Schema.String)

const userForm = Form.empty
  .addField("name", Schema.String)
  .merge(addressFields)
// Results in: { name, street, city }
```

## Field Component Props

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
