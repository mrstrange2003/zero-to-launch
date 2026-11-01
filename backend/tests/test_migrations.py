from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory

from app.db.base import Base
from app.db.session import engine
from tests.conftest import alembic_config


def test_single_migration_head():
    heads = ScriptDirectory.from_config(alembic_config()).get_heads()
    assert len(heads) == 1, f"Multiple Alembic heads, merge them: {heads}"


def test_models_match_migrations():
    with engine.connect() as conn:
        context = MigrationContext.configure(conn, opts={"compare_type": True})
        diff = compare_metadata(context, Base.metadata)
    assert diff == [], (
        "Models and migrations are out of sync; run "
        f"`alembic revision --autogenerate -m '...'`. Diff: {diff}"
    )
