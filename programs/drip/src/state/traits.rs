pub trait ByteSized
where
    Self: Sized,
{
    fn byte_size() -> usize {
        std::mem::size_of::<Self>()
    }
}
