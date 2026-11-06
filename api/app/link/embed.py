import logging
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Artifact, Link
from app.config import get_settings
import numpy as np

logger = logging.getLogger(__name__)
settings = get_settings()

try:
    from fastembed import TextEmbedding
    embedding_model = TextEmbedding(settings.embedding_model)
except Exception as e:
    logger.warning(f"Could not load embedding model: {e}")
    embedding_model = None


class EmbeddingLinker:
    """Link artifacts via embedding similarity."""

    async def embed_artifacts(self, session: AsyncSession, case_id):
        """Generate embeddings for all artifacts."""
        if not embedding_model:
            logger.warning("Embedding model not available")
            return

        artifacts = (await session.execute(
            select(Artifact).where(Artifact.case_id == case_id)
        )).scalars().all()

        texts = []
        for artifact in artifacts:
            text = f"{artifact.title or ''} {artifact.body or ''}"
            texts.append(text[:500])

        if not texts:
            return

        try:
            embeddings = list(embedding_model.embed(texts))

            for artifact, embedding in zip(artifacts, embeddings):
                artifact.embedding = f"[{','.join(map(str, embedding))}]"

            await session.flush()
            logger.info(f"Embedded {len(artifacts)} artifacts")
        except Exception as e:
            logger.error(f"Embedding error: {e}")

    async def link(self, session: AsyncSession, case_id, threshold=None) -> List[Link]:
        """Find similar artifacts via embeddings."""
        if not embedding_model:
            return []

        threshold = threshold or settings.link_threshold
        links = []

        artifacts = (await session.execute(
            select(Artifact).where(Artifact.case_id == case_id, Artifact.embedding != None)
        )).scalars().all()

        if len(artifacts) < 2:
            return links

        embeddings = []
        for artifact in artifacts:
            if artifact.embedding:
                emb = [float(x) for x in artifact.embedding.strip('[]').split(',')]
                embeddings.append(emb)

        embeddings_array = np.array(embeddings)
        similarities = np.dot(embeddings_array, embeddings_array.T)
        norms = np.linalg.norm(embeddings_array, axis=1)
        similarities = similarities / np.outer(norms, norms)

        for i in range(len(artifacts)):
            for j in range(i + 1, len(artifacts)):
                if similarities[i, j] >= threshold:
                    links.append(Link(
                        src_id=artifacts[i].id,
                        dst_id=artifacts[j].id,
                        link_type="related_to",
                        method="embedding",
                        confidence=float(similarities[i, j]),
                    ))

        for link in links:
            session.add(link)

        await session.flush()
        logger.info(f"Created {len(links)} embedding links")
        return links
