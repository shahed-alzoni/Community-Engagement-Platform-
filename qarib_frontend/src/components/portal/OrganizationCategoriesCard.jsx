import { Camera, ImagePlus, Pencil, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ApiError, categoryImageUrl, fetchOrganizationCategories, organizationImageUrl, saveOrganizationCategory, updateMyProfile, uploadOrganizationImage } from '../../services/authApi'

export function OrganizationCategoriesCard({ profile, onPrimaryUpdate }) {
  const [categories, setCategories] = useState([])
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [image, setImage] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    fetchOrganizationCategories().then((items) => {
      if (active) setCategories(Array.isArray(items) ? items : [])
    }).catch(() => { if (active) setError('Could not load categories. Please refresh the page.') })
    return () => { active = false }
  }, [])

  function open(category = null) {
    setEditing(category ?? 'new')
    setName(category === 'primary' ? profile.organization_display_name || profile.organization_name : category?.name ?? '')
    setImage(null)
    setError('')
  }

  async function save(event) {
    event.preventDefault()
    if (!name.trim()) { setError('Enter a category name.'); return }
    if (editing === 'new' && !image) { setError('Choose an image for this category.'); return }
    setBusy(true)
    setError('')
    try {
      if (editing === 'primary') {
        if (name.trim() !== (profile.organization_display_name || profile.organization_name)) {
          const updated = await updateMyProfile({ organization_display_name: name.trim() })
          onPrimaryUpdate({ organization_display_name: updated.organization_display_name })
        }
        if (image) {
          const updated = await uploadOrganizationImage(image)
          onPrimaryUpdate({ organization_image_version: updated.image_version })
        }
      } else {
        const saved = await saveOrganizationCategory({ id: editing === 'new' ? null : editing.id, name: name.trim(), image })
        setCategories((current) => editing === 'new' ? [...current, saved] : current.map((item) => item.id === saved.id ? saved : item))
      }
      setEditing(null)
      setImage(null)
    } catch (reason) {
      const fieldError = reason instanceof ApiError ? reason.errors?.organization_display_name?.[0] || reason.errors?.name?.[0] || reason.errors?.image?.[0] : null
      setError(fieldError || reason.message || 'Could not save the category.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="portal-profile-card portal-categories-card">
    <div className="portal-categories-heading"><div><h2>Compliment categories</h2><p>Manage the names and images citizens see when submitting a complaint.</p></div><button type="button" className="portal-category-add" onClick={() => open()}><Plus size={18} /> Add category</button></div>
    <div className="portal-categories-list">
      <div className="portal-category-item">
        {profile.organization_image_version ? <img src={organizationImageUrl(profile.organization_id, profile.organization_image_version)} alt="" /> : <span className="portal-category-image-placeholder"><ImagePlus size={22} /></span>}
        <strong>{profile.organization_display_name || profile.organization_name}</strong>
        <button type="button" onClick={() => open('primary')} aria-label={`Edit ${profile.organization_display_name || profile.organization_name}`}><Pencil size={17} /></button>
      </div>
      {categories.map((category) => <div className="portal-category-item" key={category.id}><img src={categoryImageUrl(category.id, category.image_version)} alt="" /><strong>{category.name}</strong><button type="button" onClick={() => open(category)} aria-label={`Edit ${category.name}`}><Pencil size={17} /></button></div>)}
    </div>
    {editing ? <form className="portal-category-form" onSubmit={save}>
      <div className="portal-category-form-title"><strong>{editing === 'new' ? 'Add category' : 'Edit category'}</strong><button type="button" onClick={() => { setEditing(null); setError('') }} aria-label="Close category form"><X size={18} /></button></div>
      <label>Category name<input value={name} maxLength={150} onChange={(event) => setName(event.target.value)} required /></label>
      <label className="portal-category-image-picker"><span className="portal-category-image-control"><Camera size={18} /> Choose image</span><input className="portal-category-file-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label={editing === 'new' ? 'Category image' : 'Replace image (optional)'} onChange={(event) => setImage(event.target.files?.[0] ?? null)} aria-required={editing === 'new'} /></label>
      {error ? <small className="portal-category-error" role="alert">{error}</small> : null}
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save category'}</button>
    </form> : error ? <small className="portal-category-error" role="alert">{error}</small> : null}
  </section>
}
