# Collection Create, Item Update Prompt

```text
/dashboard we need to add the ability to create collections in order to start storing items in them. Name and Description

We should follow the same patterns as items. Collections should  fetch from the server component via lib/db functions and api routes for any client-side calls

The create button should open a modal with the fields needed. Show a toast on success or failure. Make sure everything is updated with the new collection on save.

have a look at the prisma file to see the correct tables to ensure collection and items are properly connected.
```

## Add Items To Collection Prompt

```text
 Add functionality to add an item to a single or multiple collections. Add a dropdown with collection types to the new/edit item forms where we can select from the available collections to add the item to.
```

## Collections Page Prompt

```text
create the /collections page and show the collections

Create the /collections/[id] page to show the items in that collection

Use the existing cards
```

## Collection Edit/Delete Prompt

```text
 Add buttons on /collections/[id] to edit, delete and favorite. Use the same methadology as items.
```